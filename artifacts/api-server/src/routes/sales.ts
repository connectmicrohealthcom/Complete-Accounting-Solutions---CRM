import { Router, type IRouter } from "express";
import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { db, salesTable, saleItemsTable, staffTable, clientsTable, clientsTable as ct, servicesTable, productsTable, appointmentsTable } from "@workspace/db";
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
  if (from) conditions.push(gte(salesTable.createdAt, new Date(from)));
  if (to) { const toDate = new Date(to); toDate.setHours(23, 59, 59, 999); conditions.push(lte(salesTable.createdAt, toDate)); }

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
  if (items.length === 0) { res.status(400).json({ error: "At least one sale item is required" }); return; }
  if (!Number.isFinite(discount) || discount < 0) { res.status(400).json({ error: "Discount cannot be negative" }); return; }

  try {
    const result = await db.transaction(async (tx) => {
      const [staff] = await tx.select().from(staffTable).where(eq(staffTable.id, saleData.staffId));
      if (!staff || !staff.isActive) throw new Error("STAFF_NOT_ACTIVE");

      if (saleData.clientId != null) {
        const [client] = await tx.select().from(clientsTable).where(eq(clientsTable.id, saleData.clientId));
        if (!client) throw new Error("CLIENT_NOT_FOUND");
      }

      if (saleData.appointmentId != null) {
        const [appointment] = await tx.select().from(appointmentsTable).where(eq(appointmentsTable.id, saleData.appointmentId));
        if (!appointment) throw new Error("APPOINTMENT_NOT_FOUND");
        if (["cancelled", "no_show"].includes(appointment.status)) throw new Error("APPOINTMENT_CLOSED");
        const [existingSale] = await tx.select({ id: salesTable.id }).from(salesTable).where(eq(salesTable.appointmentId, saleData.appointmentId)).limit(1);
        if (existingSale) throw new Error("APPOINTMENT_ALREADY_SOLD");
      }

      const authoritativeItems: Array<typeof items[number] & { unitPrice: number }> = [];
      for (const item of items) {
        if (!Number.isInteger(item.quantity) || item.quantity < 1) throw new Error("INVALID_QUANTITY");
        if (item.referenceId == null) throw new Error("ITEM_REFERENCE_REQUIRED");

        if (item.type === "service") {
          const [service] = await tx.select().from(servicesTable).where(eq(servicesTable.id, item.referenceId));
          if (!service || !service.isActive) throw new Error("SERVICE_NOT_AVAILABLE");
          authoritativeItems.push({ ...item, name: service.name, unitPrice: Number(service.price) });
        } else {
          const [product] = await tx.select().from(productsTable).where(eq(productsTable.id, item.referenceId));
          if (!product || !product.isActive) throw new Error("PRODUCT_NOT_AVAILABLE");
          if (product.stockQuantity < item.quantity) throw new Error("INSUFFICIENT_STOCK");
          authoritativeItems.push({ ...item, name: product.name, unitPrice: Number(product.price) });
        }
      }

      const subtotal = authoritativeItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
      if (discount > subtotal) throw new Error("DISCOUNT_EXCEEDS_SUBTOTAL");
      const total = Math.round((subtotal - discount) * 100) / 100;

      if (saleData.paymentMethod === "loyalty_points") {
        if (saleData.clientId == null) throw new Error("LOYALTY_CLIENT_REQUIRED");
        if (!Number.isInteger(total)) throw new Error("LOYALTY_TOTAL_MUST_BE_WHOLE_POINTS");
        const [client] = await tx.select().from(clientsTable).where(eq(clientsTable.id, saleData.clientId));
        if (!client || client.loyaltyPoints < total) throw new Error("INSUFFICIENT_LOYALTY_POINTS");
        await tx.update(clientsTable).set({ loyaltyPoints: client.loyaltyPoints - total }).where(eq(clientsTable.id, client.id));
      }

      for (const item of authoritativeItems.filter(i => i.type === "product")) {
        const updated = await tx.update(productsTable)
          .set({ stockQuantity: sql`${productsTable.stockQuantity} - ${item.quantity}` })
          .where(and(eq(productsTable.id, item.referenceId!), gte(productsTable.stockQuantity, item.quantity)))
          .returning({ id: productsTable.id });
        if (!updated.length) throw new Error("INSUFFICIENT_STOCK");
      }

      const [sale] = await tx.insert(salesTable).values({
        ...saleData,
        subtotal: String(subtotal),
        discount: String(discount),
        total: String(total),
      }).returning();

      await tx.insert(saleItemsTable).values(authoritativeItems.map((item) => ({
        saleId: sale.id,
        type: item.type,
        referenceId: item.referenceId ?? null,
        name: item.name,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        totalPrice: String(item.unitPrice * item.quantity),
      })));

      if (saleData.clientId) {
        const [client] = await tx.select().from(clientsTable).where(eq(clientsTable.id, saleData.clientId));
        if (client) {
          const earnedPoints = saleData.paymentMethod === "loyalty_points" ? 0 : Math.floor(total);
          const spentPoints = saleData.paymentMethod === "loyalty_points" ? total : 0;
          await tx.update(clientsTable).set({
            totalSpent: String(Number(client.totalSpent) + total),
            visitCount: client.visitCount + 1,
            lastVisit: new Date(),
            loyaltyPoints: client.loyaltyPoints - spentPoints + earnedPoints,
          }).where(eq(clientsTable.id, client.id));
        }
      }

      if (saleData.appointmentId != null) {
        await tx.update(appointmentsTable)
          .set({ status: "completed" })
          .where(eq(appointmentsTable.id, saleData.appointmentId));
      }

      return sale;
    });

    res.status(201).json(await buildSaleResponse(result));
  } catch (error) {
    const messages: Record<string, [number, string]> = {
      STAFF_NOT_ACTIVE: [400, "Staff member is not active"],
      CLIENT_NOT_FOUND: [404, "Client not found"],
      APPOINTMENT_NOT_FOUND: [404, "Appointment not found"],
      APPOINTMENT_CLOSED: [409, "Appointment cannot be sold because it is closed"],
      APPOINTMENT_ALREADY_SOLD: [409, "Appointment already has a sale"],
      INVALID_QUANTITY: [400, "Quantity must be a positive whole number"],
      ITEM_REFERENCE_REQUIRED: [400, "Each service or product must reference a catalogue item"],
      SERVICE_NOT_AVAILABLE: [400, "Service is not active or does not exist"],
      PRODUCT_NOT_AVAILABLE: [400, "Product is not active or does not exist"],
      INSUFFICIENT_STOCK: [409, "Insufficient product stock"],
      DISCOUNT_EXCEEDS_SUBTOTAL: [400, "Discount cannot exceed the subtotal"],
      LOYALTY_CLIENT_REQUIRED: [400, "A client is required for loyalty-point payment"],
      LOYALTY_TOTAL_MUST_BE_WHOLE_POINTS: [400, "Loyalty-point payments must use a whole-number total"],
      INSUFFICIENT_LOYALTY_POINTS: [409, "Insufficient loyalty points"],
    };
    const key = error instanceof Error ? error.message : "";
    const mapped = messages[key];
    if (mapped) { res.status(mapped[0]).json({ error: mapped[1] }); return; }
    throw error;
  }
});

router.get("/sales/summary", async (req, res): Promise<void> => {
  const query = GetSalesSummaryQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const conditions: any[] = [];
  if (query.data.from) conditions.push(gte(salesTable.createdAt, new Date(query.data.from)));
  if (query.data.to) { const toDate = new Date(query.data.to); toDate.setHours(23, 59, 59, 999); conditions.push(lte(salesTable.createdAt, toDate)); }
  const sales = await db.select().from(salesTable).where(conditions.length ? and(...conditions) : undefined);

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
