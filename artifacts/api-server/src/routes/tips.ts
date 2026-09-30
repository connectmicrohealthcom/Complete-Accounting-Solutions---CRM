import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import { db, tipsTable, staffTable, salesTable, clientsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/tips", async (req, res): Promise<void> => {
  const { from, to, staffId } = req.query as { from?: string; to?: string; staffId?: string };

  const conditions: any[] = [];
  if (staffId) conditions.push(eq(tipsTable.staffId, parseInt(staffId)));
  if (from) conditions.push(gte(tipsTable.createdAt, new Date(from)));
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(tipsTable.createdAt, toDate));
  }

  const tips = await db
    .select()
    .from(tipsTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(tipsTable.createdAt));

  const enriched = await Promise.all(
    tips.map(async (tip) => {
      const [[staff], [client]] = await Promise.all([
        db.select().from(staffTable).where(eq(staffTable.id, tip.staffId)),
        tip.clientId
          ? db.select().from(clientsTable).where(eq(clientsTable.id, tip.clientId))
          : Promise.resolve([null]),
      ]);
      return {
        ...tip,
        amount: Number(tip.amount),
        staffName: staff?.name ?? "Unknown",
        clientName: (client as any)?.name ?? "Walk-in",
        createdAt: tip.createdAt.toISOString(),
      };
    })
  );

  res.json(enriched);
});

router.get("/tips/summary", async (req, res): Promise<void> => {
  const { from, to } = req.query as { from?: string; to?: string };

  const conditions: any[] = [];
  if (from) conditions.push(gte(tipsTable.createdAt, new Date(from)));
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    conditions.push(lte(tipsTable.createdAt, toDate));
  }

  const tips = await db
    .select()
    .from(tipsTable)
    .where(conditions.length ? and(...conditions) : undefined);

  const totalTips = tips.reduce((s, t) => s + Number(t.amount), 0);

  const byStaffMap: Record<number, { staffId: number; total: number; count: number }> = {};
  for (const tip of tips) {
    if (!byStaffMap[tip.staffId]) byStaffMap[tip.staffId] = { staffId: tip.staffId, total: 0, count: 0 };
    byStaffMap[tip.staffId].total += Number(tip.amount);
    byStaffMap[tip.staffId].count += 1;
  }

  const allStaff = await db.select().from(staffTable);
  const byStaff = Object.values(byStaffMap).map((s) => ({
    ...s,
    staffName: allStaff.find((st) => st.id === s.staffId)?.name ?? "Unknown",
  })).sort((a, b) => b.total - a.total);

  res.json({ totalTips, tipCount: tips.length, byStaff });
});

router.post("/tips", async (req, res): Promise<void> => {
  const { saleId, staffId, clientId, amount, note } = req.body;
  if (!saleId || !staffId || !amount) {
    res.status(400).json({ error: "saleId, staffId, and amount are required" });
    return;
  }
  const [tip] = await db.insert(tipsTable).values({
    saleId: parseInt(saleId),
    staffId: parseInt(staffId),
    clientId: clientId ? parseInt(clientId) : null,
    amount: String(amount),
    note: note || null,
  }).returning();
  res.status(201).json({ ...tip, amount: Number(tip.amount) });
});

export default router;
