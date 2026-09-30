import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { db, salesTable, saleItemsTable, staffTable, clientsTable, clientsTable as ct } from "@workspace/db";
import {
  CreateSaleBody,
  GetSaleParams,
  ListSalesQueryParams,
  GetSalesSummaryQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

async function buildSaleResponse(sale: typeof salesTable.$inferSelect) {
  const [[client], [staff], items] = await Promise.all([
    sale.clientId ? db.select().from(clientsTable).where(eq(clientsTable.id, sale.clientId)) : [[]],
    db.select().from(staffTable).where(eq(staffTable.id, sale.staffId)),
    db.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, sale.id)),
  ]);

  return {
    ...sale,
    clientName: (client as any)?.name ?? null,
    staffName: (staff as any)?.name ?? "Unknown",
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    total: Number(sale.total),
    createdAt: sale.createdAt.toISOString(),
    items: items.map((item) => ({
      ...item,
      unitPrice: Number(item.unitPrice),
      totalPrice: Number(item.totalPrice),
    })),
  };
}

router.get("/sales", async (req, res): Promise<void> => {
  const query = ListSalesQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const { from, to, staffId, clientId, paymentMethod, page = 1, limit = 20 } = query.data;

  let q = db.select().from(salesTable).$dynamic();
  let cq = db.select({ count: sql<number>`count(*)` }).from(salesTable).$dynamic();

  const conditions = [];
  if (staffId) conditions.push(eq(salesTable.staffId, staffId));
  if (clientId) conditions.push(eq(salesTable.clientId, clientId));
  if (paymentMethod) conditions.push(eq(salesTable.paymentMethod, paymentMethod as any));

  if (conditions.length > 0) {
    q = q.where(and(...conditions)) as any;
    cq = cq.where(and(...conditions)) as any;
  }

  const offset = (page - 1) * limit;
  const [sales, countResult] = await Promise.all([
    (q as any).orderBy(desc(salesTable.createdAt)).limit(limit).offset(offset),
    cq,
  ]);

  const built = await Promise.all(sales.map(buildSaleResponse));
  res.json({ sales: built, total: Number(countResult[0]?.count ?? 0), page, limit });
});

router.post("/sales", async (req, res): Promise<void> => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { items, discount = 0, ...saleData } = parsed.data;
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const total = Math.max(0, subtotal - discount);

  const [sale] = await db.insert(salesTable).values({
    ...saleData,
    subtotal: String(subtotal),
    discount: String(discount),
    total: String(total),
  }).returning();

  const saleItemRows = items.map((i) => ({
    saleId: sale.id,
    type: i.type,
    referenceId: i.referenceId ?? null,
    name: i.name,
    quantity: i.quantity,
    unitPrice: String(i.unitPrice),
    totalPrice: String(i.unitPrice * i.quantity),
  }));

  await db.insert(saleItemsTable).values(saleItemRows);

  // Update client stats
  if (saleData.clientId) {
    await db.execute(sql`
      UPDATE clients SET
        total_spent = total_spent + ${total},
        visit_count = visit_count + 1,
        last_visit = NOW(),
        loyalty_points = loyalty_points + ${Math.floor(total)}
      WHERE id = ${saleData.clientId}
    `);
  }

  res.status(201).json(await buildSaleResponse(sale));
});

router.get("/sales/summary", async (req, res): Promise<void> => {
  const query = GetSalesSummaryQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const sales = await db.select().from(salesTable);

  const totalRevenue = sales.reduce((s, x) => s + Number(x.total), 0);
  const totalTransactions = sales.length;
  const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  const methodMap: Record<string, { total: number; count: number }> = {};
  for (const s of sales) {
    if (!methodMap[s.paymentMethod]) methodMap[s.paymentMethod] = { total: 0, count: 0 };
    methodMap[s.paymentMethod].total += Number(s.total);
    methodMap[s.paymentMethod].count += 1;
  }

  res.json({
    totalRevenue,
    totalTransactions,
    avgTransactionValue,
    byPaymentMethod: Object.entries(methodMap).map(([method, v]) => ({ method, ...v })),
  });
});

router.get("/sales/:id", async (req, res): Promise<void> => {
  const params = GetSaleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [sale] = await db.select().from(salesTable).where(eq(salesTable.id, params.data.id));
  if (!sale) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildSaleResponse(sale));
});

export default router;
