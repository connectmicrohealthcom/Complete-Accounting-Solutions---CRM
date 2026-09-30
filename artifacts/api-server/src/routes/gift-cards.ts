import { Router, type IRouter } from "express";
import { eq, desc, sql } from "drizzle-orm";
import {
  db,
  giftCardTypesTable,
  giftCardsTable,
  walletTransactionsTable,
  clientsTable,
} from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const CreateGiftCardTypeBody = z.object({
  name: z.string().min(1),
  purchaseAmount: z.number().positive(),
  creditAmount: z.number().positive(),
  validityDays: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
});

const UpdateGiftCardTypeBody = CreateGiftCardTypeBody.partial();

const SellGiftCardBody = z.object({
  clientId: z.number().int(),
  typeId: z.number().int(),
  paymentMethod: z.string().default("cash"),
});

const WalletRedeemBody = z.object({
  amount: z.number().positive(),
  description: z.string(),
  referenceType: z.string().optional(),
  referenceId: z.number().int().optional(),
});

function generateReferenceCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "GC-";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

router.get("/gift-card-types", async (_req, res): Promise<void> => {
  const types = await db.select().from(giftCardTypesTable).orderBy(giftCardTypesTable.name);
  res.json(types.map((t) => ({
    ...t,
    purchaseAmount: Number(t.purchaseAmount),
    creditAmount: Number(t.creditAmount),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  })));
});

router.post("/gift-card-types", async (req, res): Promise<void> => {
  const parsed = CreateGiftCardTypeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [type] = await db.insert(giftCardTypesTable).values({
    ...parsed.data,
    purchaseAmount: String(parsed.data.purchaseAmount),
    creditAmount: String(parsed.data.creditAmount),
  }).returning();

  res.status(201).json({
    ...type,
    purchaseAmount: Number(type.purchaseAmount),
    creditAmount: Number(type.creditAmount),
    createdAt: type.createdAt.toISOString(),
    updatedAt: type.updatedAt.toISOString(),
  });
});

router.patch("/gift-card-types/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateGiftCardTypeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const updateData: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.purchaseAmount !== undefined) updateData.purchaseAmount = String(parsed.data.purchaseAmount);
  if (parsed.data.creditAmount !== undefined) updateData.creditAmount = String(parsed.data.creditAmount);

  const [type] = await db.update(giftCardTypesTable).set(updateData).where(eq(giftCardTypesTable.id, id)).returning();
  if (!type) { res.status(404).json({ error: "Not found" }); return; }

  res.json({
    ...type,
    purchaseAmount: Number(type.purchaseAmount),
    creditAmount: Number(type.creditAmount),
    createdAt: type.createdAt.toISOString(),
    updatedAt: type.updatedAt.toISOString(),
  });
});

router.delete("/gift-card-types/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(giftCardTypesTable).where(eq(giftCardTypesTable.id, id));
  res.json({ success: true });
});

router.post("/gift-cards", async (req, res): Promise<void> => {
  const parsed = SellGiftCardBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { clientId, typeId, paymentMethod } = parsed.data;

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  const [type] = await db.select().from(giftCardTypesTable).where(eq(giftCardTypesTable.id, typeId));
  if (!type) { res.status(404).json({ error: "Gift card type not found" }); return; }

  let referenceCode = generateReferenceCode();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await db.select({ id: giftCardsTable.id }).from(giftCardsTable).where(eq(giftCardsTable.referenceCode, referenceCode));
    if (!existing.length) break;
    referenceCode = generateReferenceCode();
    attempts++;
  }

  let expiryDate: string | null = null;
  if (type.validityDays) {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + type.validityDays);
    expiryDate = expiry.toISOString().split("T")[0];
  }

  const [card] = await db.insert(giftCardsTable).values({
    clientId,
    typeId,
    referenceCode,
    purchaseAmount: String(type.purchaseAmount),
    creditAmount: String(type.creditAmount),
    remainingBalance: String(type.creditAmount),
    paymentMethod,
    expiryDate,
    status: "active",
  }).returning();

  const newBalance = Number(client.walletBalance) + Number(type.creditAmount);
  await db.update(clientsTable).set({ walletBalance: String(newBalance) }).where(eq(clientsTable.id, clientId));

  await db.insert(walletTransactionsTable).values({
    clientId,
    type: "credit",
    amount: String(type.creditAmount),
    balanceAfter: String(newBalance),
    description: `Gift card purchased: ${type.name} (${referenceCode})`,
    referenceType: "gift_card",
    referenceId: card.id,
  });

  res.status(201).json({
    ...card,
    purchaseAmount: Number(card.purchaseAmount),
    creditAmount: Number(card.creditAmount),
    remainingBalance: Number(card.remainingBalance),
    purchasedAt: card.purchasedAt.toISOString(),
    typeName: type.name,
    clientName: client.name,
  });
});

router.get("/gift-cards", async (_req, res): Promise<void> => {
  const cards = await db
    .select()
    .from(giftCardsTable)
    .leftJoin(clientsTable, eq(giftCardsTable.clientId, clientsTable.id))
    .leftJoin(giftCardTypesTable, eq(giftCardsTable.typeId, giftCardTypesTable.id))
    .orderBy(desc(giftCardsTable.purchasedAt));

  const today = new Date().toISOString().split("T")[0];

  res.json(cards.map((row) => {
    const c = row.gift_cards;
    let status = c.status;
    if (status === "active" && c.expiryDate && c.expiryDate < today) status = "expired";
    if (status === "active" && Number(c.remainingBalance) <= 0) status = "redeemed";
    return {
      id: c.id,
      clientId: c.clientId,
      clientName: row.clients?.name ?? "Unknown",
      typeId: c.typeId,
      typeName: row.gift_card_types?.name ?? "Unknown",
      referenceCode: c.referenceCode,
      purchaseAmount: Number(c.purchaseAmount),
      creditAmount: Number(c.creditAmount),
      remainingBalance: Number(c.remainingBalance),
      paymentMethod: c.paymentMethod,
      expiryDate: c.expiryDate,
      status,
      purchasedAt: c.purchasedAt.toISOString(),
    };
  }));
});

router.get("/clients/:id/wallet", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.id);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) { res.status(404).json({ error: "Not found" }); return; }

  const transactions = await db
    .select()
    .from(walletTransactionsTable)
    .where(eq(walletTransactionsTable.clientId, clientId))
    .orderBy(desc(walletTransactionsTable.createdAt));

  res.json({
    clientId,
    balance: Number(client.walletBalance),
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      balanceAfter: Number(t.balanceAfter),
      description: t.description,
      referenceType: t.referenceType,
      referenceId: t.referenceId,
      createdAt: t.createdAt.toISOString(),
    })),
  });
});

router.post("/clients/:id/wallet/redeem", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.id);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = WalletRedeemBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) { res.status(404).json({ error: "Not found" }); return; }

  const currentBalance = Number(client.walletBalance);
  if (currentBalance < parsed.data.amount) {
    res.status(400).json({ error: "Insufficient wallet balance" });
    return;
  }

  if (parsed.data.referenceType === "gift_card") {
    if (!parsed.data.referenceId) { res.status(400).json({ error: "Gift card referenceId is required" }); return; }
    const [card] = await db.select().from(giftCardsTable).where(eq(giftCardsTable.id, parsed.data.referenceId));
    if (!card || card.clientId !== clientId) { res.status(404).json({ error: "Gift card not found for client" }); return; }
    const today = new Date().toISOString().split("T")[0];
    if (card.status !== "active" || (card.expiryDate != null && card.expiryDate < today)) {
      res.status(409).json({ error: "Gift card is not active" });
      return;
    }
    if (Number(card.remainingBalance) < parsed.data.amount) {
      res.status(400).json({ error: "Insufficient gift card balance" });
      return;
    }
    await db.update(giftCardsTable)
      .set({ remainingBalance: String(Number(card.remainingBalance) - parsed.data.amount) })
      .where(eq(giftCardsTable.id, card.id));
  }

  const newBalance = currentBalance - parsed.data.amount;
  await db.update(clientsTable).set({ walletBalance: String(newBalance) }).where(eq(clientsTable.id, clientId));

  await db.insert(walletTransactionsTable).values({
    clientId,
    type: "debit",
    amount: String(parsed.data.amount),
    balanceAfter: String(newBalance),
    description: parsed.data.description,
    referenceType: parsed.data.referenceType,
    referenceId: parsed.data.referenceId,
  });

  res.json({ clientId, balance: newBalance });
});

router.get("/gift-cards/liability", async (_req, res): Promise<void> => {
  const activeCards = await db
    .select()
    .from(giftCardsTable)
    .leftJoin(giftCardTypesTable, eq(giftCardsTable.typeId, giftCardTypesTable.id))
    .where(eq(giftCardsTable.status, "active"));

  const today = new Date().toISOString().split("T")[0];

  let totalLiability = 0;
  const byType: Record<string, { typeName: string; count: number; liability: number }> = {};

  for (const row of activeCards) {
    const c = row.gift_cards;
    if (c.expiryDate && c.expiryDate < today) continue;
    const balance = Number(c.remainingBalance);
    if (balance <= 0) continue;

    totalLiability += balance;
    const typeName = row.gift_card_types?.name ?? "Unknown";
    if (!byType[typeName]) byType[typeName] = { typeName, count: 0, liability: 0 };
    byType[typeName].count++;
    byType[typeName].liability += balance;
  }

  const totalClients = await db
    .select({ balance: clientsTable.walletBalance })
    .from(clientsTable)
    .where(sql`${clientsTable.walletBalance}::numeric > 0`);

  res.json({
    totalLiability,
    totalActiveWallets: totalClients.length,
    breakdown: Object.values(byType),
  });
});

export default router;
