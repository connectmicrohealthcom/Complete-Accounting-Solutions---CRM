import { Router, type IRouter } from "express";
import { eq, ilike, or, sql, desc } from "drizzle-orm";
import { db, clientsTable, appointmentsTable, salesTable, saleItemsTable } from "@workspace/db";
import {
  CreateClientBody,
  UpdateClientBody,
  GetClientParams,
  UpdateClientParams,
  DeleteClientParams,
  GetClientHistoryParams,
  ListClientsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatClient(c: typeof clientsTable.$inferSelect) {
  return {
    ...c,
    totalSpent: Number(c.totalSpent),
    lastVisit: c.lastVisit ? c.lastVisit.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  };
}

router.get("/clients", async (req, res): Promise<void> => {
  const query = ListClientsQueryParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const { search, page = 1, limit = 20 } = query.data;
  const offset = (page - 1) * limit;

  let baseQuery = db.select().from(clientsTable);
  let countQuery = db.select({ count: sql<number>`count(*)` }).from(clientsTable);

  if (search) {
    const searchFilter = or(
      ilike(clientsTable.name, `%${search}%`),
      ilike(clientsTable.email, `%${search}%`),
      ilike(clientsTable.phone, `%${search}%`)
    );
    baseQuery = baseQuery.where(searchFilter) as any;
    countQuery = countQuery.where(searchFilter) as any;
  }

  const [clients, countResult] = await Promise.all([
    (baseQuery as any).orderBy(desc(clientsTable.createdAt)).limit(limit).offset(offset),
    countQuery,
  ]);

  res.json({
    clients: clients.map(formatClient),
    total: Number(countResult[0]?.count ?? 0),
    page,
    limit,
  });
});

router.post("/clients", async (req, res): Promise<void> => {
  const parsed = CreateClientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [client] = await db.insert(clientsTable).values(parsed.data).returning();
  res.status(201).json(formatClient(client));
});

router.get("/clients/:id", async (req, res): Promise<void> => {
  const params = GetClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, params.data.id));
  if (!client) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatClient(client));
});

router.patch("/clients/:id", async (req, res): Promise<void> => {
  const params = UpdateClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateClientBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [client] = await db.update(clientsTable).set(parsed.data).where(eq(clientsTable.id, params.data.id)).returning();
  if (!client) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatClient(client));
});

router.delete("/clients/:id", async (req, res): Promise<void> => {
  const params = DeleteClientParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(clientsTable).where(eq(clientsTable.id, params.data.id));
  res.sendStatus(204);
});

router.get("/clients/:id/history", async (req, res): Promise<void> => {
  const params = GetClientHistoryParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [appointments, sales] = await Promise.all([
    db.select().from(appointmentsTable).where(eq(appointmentsTable.clientId, params.data.id)).orderBy(desc(appointmentsTable.createdAt)).limit(20),
    db.select().from(salesTable).where(eq(salesTable.clientId, params.data.id)).orderBy(desc(salesTable.createdAt)).limit(20),
  ]);

  res.json({ appointments, sales });
});

export default router;
