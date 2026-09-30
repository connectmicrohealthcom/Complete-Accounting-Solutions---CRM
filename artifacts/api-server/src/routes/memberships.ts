import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import {
  db,
  membershipPlansTable,
  membershipPlanServicesTable,
  clientMembershipsTable,
  clientMembershipUsageTable,
  servicesTable,
  clientsTable,
} from "@workspace/db";
import { z } from "zod";

const router: IRouter = Router();

const CreateMembershipPlanBody = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.number().positive(),
  validityDays: z.number().int().positive().default(365),
  loyaltyPointsBonus: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  services: z.array(z.object({ serviceId: z.number().int(), quantity: z.number().int().min(1) })).optional(),
});

const UpdateMembershipPlanBody = CreateMembershipPlanBody.partial();

const AssignMembershipBody = z.object({
  clientId: z.number().int(),
  planId: z.number().int(),
  startDate: z.string(),
  paymentMethod: z.string().default("cash"),
});

const RecordUsageBody = z.object({
  serviceId: z.number().int(),
  notes: z.string().optional(),
});

async function buildPlanResponse(plan: typeof membershipPlansTable.$inferSelect) {
  const planServices = await db
    .select({ serviceId: membershipPlanServicesTable.serviceId, serviceName: servicesTable.name, quantity: membershipPlanServicesTable.quantity })
    .from(membershipPlanServicesTable)
    .leftJoin(servicesTable, eq(membershipPlanServicesTable.serviceId, servicesTable.id))
    .where(eq(membershipPlanServicesTable.planId, plan.id));

  return {
    ...plan,
    price: Number(plan.price),
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    services: planServices.map((ps) => ({
      serviceId: ps.serviceId,
      serviceName: ps.serviceName ?? "Unknown",
      quantity: ps.quantity,
    })),
  };
}

router.get("/membership-plans", async (_req, res): Promise<void> => {
  const plans = await db.select().from(membershipPlansTable).orderBy(membershipPlansTable.name);
  const result = await Promise.all(plans.map(buildPlanResponse));
  res.json(result);
});

router.post("/membership-plans", async (req, res): Promise<void> => {
  const parsed = CreateMembershipPlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { services, ...planData } = parsed.data;
  const [plan] = await db.insert(membershipPlansTable).values({
    ...planData,
    price: String(planData.price),
  }).returning();

  if (services?.length) {
    await db.insert(membershipPlanServicesTable).values(
      services.map((s) => ({ planId: plan.id, serviceId: s.serviceId, quantity: s.quantity }))
    );
  }

  res.status(201).json(await buildPlanResponse(plan));
});

router.patch("/membership-plans/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateMembershipPlanBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { services, ...planData } = parsed.data;
  const updateData: Record<string, unknown> = { ...planData };
  if (planData.price !== undefined) updateData.price = String(planData.price);

  const [plan] = await db.update(membershipPlansTable).set(updateData).where(eq(membershipPlansTable.id, id)).returning();
  if (!plan) { res.status(404).json({ error: "Not found" }); return; }

  if (services !== undefined) {
    await db.delete(membershipPlanServicesTable).where(eq(membershipPlanServicesTable.planId, id));
    if (services.length) {
      await db.insert(membershipPlanServicesTable).values(
        services.map((s) => ({ planId: plan.id, serviceId: s.serviceId, quantity: s.quantity }))
      );
    }
  }

  res.json(await buildPlanResponse(plan));
});

router.delete("/membership-plans/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(membershipPlansTable).where(eq(membershipPlansTable.id, id));
  res.json({ success: true });
});

router.post("/client-memberships", async (req, res): Promise<void> => {
  const parsed = AssignMembershipBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const { clientId, planId, startDate, paymentMethod } = parsed.data;

  const [client] = await db.select().from(clientsTable).where(eq(clientsTable.id, clientId));
  if (!client) { res.status(404).json({ error: "Client not found" }); return; }

  const [plan] = await db.select().from(membershipPlansTable).where(eq(membershipPlansTable.id, planId));
  if (!plan) { res.status(404).json({ error: "Plan not found" }); return; }
  if (!plan.isActive) { res.status(409).json({ error: "Membership plan is inactive" }); return; }

  const start = new Date(startDate);
  const expiry = new Date(start);
  expiry.setDate(expiry.getDate() + plan.validityDays);
  const expiryDate = expiry.toISOString().split("T")[0];

  const [membership] = await db.insert(clientMembershipsTable).values({
    clientId,
    planId,
    startDate,
    expiryDate,
    amountPaid: String(plan.price),
    paymentMethod,
    status: "active",
  }).returning();

  if (plan.loyaltyPointsBonus > 0) {
    await db.update(clientsTable)
      .set({ loyaltyPoints: client.loyaltyPoints + plan.loyaltyPointsBonus })
      .where(eq(clientsTable.id, clientId));
  }

  res.status(201).json({
    ...membership,
    amountPaid: Number(membership.amountPaid),
    planName: plan.name,
    clientName: client.name,
    purchasedAt: membership.purchasedAt.toISOString(),
  });
});

router.get("/clients/:id/memberships", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.id);
  if (isNaN(clientId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const memberships = await db
    .select()
    .from(clientMembershipsTable)
    .leftJoin(membershipPlansTable, eq(clientMembershipsTable.planId, membershipPlansTable.id))
    .where(eq(clientMembershipsTable.clientId, clientId))
    .orderBy(desc(clientMembershipsTable.purchasedAt));

  const result = await Promise.all(memberships.map(async (row) => {
    const m = row.client_memberships;
    const plan = row.membership_plans;
    if (!plan) return null;

    const planServices = await db
      .select({ serviceId: membershipPlanServicesTable.serviceId, serviceName: servicesTable.name, quantity: membershipPlanServicesTable.quantity })
      .from(membershipPlanServicesTable)
      .leftJoin(servicesTable, eq(membershipPlanServicesTable.serviceId, servicesTable.id))
      .where(eq(membershipPlanServicesTable.planId, plan.id));

    const usageRows = await db
      .select()
      .from(clientMembershipUsageTable)
      .where(eq(clientMembershipUsageTable.clientMembershipId, m.id));

    const usageByService: Record<number, number> = {};
    for (const u of usageRows) {
      usageByService[u.serviceId] = (usageByService[u.serviceId] ?? 0) + 1;
    }

    const today = new Date().toISOString().split("T")[0];
    const status = m.status === "cancelled" ? "cancelled" : m.expiryDate < today ? "expired" : "active";

    return {
      id: m.id,
      planId: plan.id,
      planName: plan.name,
      startDate: m.startDate,
      expiryDate: m.expiryDate,
      amountPaid: Number(m.amountPaid),
      paymentMethod: m.paymentMethod,
      status,
      purchasedAt: m.purchasedAt.toISOString(),
      services: planServices.map((ps) => ({
        serviceId: ps.serviceId!,
        serviceName: ps.serviceName ?? "Unknown",
        total: ps.quantity,
        used: usageByService[ps.serviceId!] ?? 0,
        remaining: ps.quantity - (usageByService[ps.serviceId!] ?? 0),
      })),
    };
  }));

  res.json(result.filter(Boolean));
});

router.post("/client-memberships/:id/use", async (req, res): Promise<void> => {
  const membershipId = parseInt(req.params.id);
  if (isNaN(membershipId)) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = RecordUsageBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [membership] = await db.select().from(clientMembershipsTable).where(eq(clientMembershipsTable.id, membershipId));
  if (!membership) { res.status(404).json({ error: "Membership not found" }); return; }

  const today = new Date().toISOString().split("T")[0];
  if (membership.status !== "active" || membership.expiryDate < today) {
    res.status(409).json({ error: "Membership is expired or inactive" });
    return;
  }

  const [included] = await db.select().from(membershipPlanServicesTable)
    .where(and(eq(membershipPlanServicesTable.planId, membership.planId), eq(membershipPlanServicesTable.serviceId, parsed.data.serviceId)));
  if (!included) { res.status(400).json({ error: "Service is not included in this membership" }); return; }

  const used = await db.select().from(clientMembershipUsageTable)
    .where(and(eq(clientMembershipUsageTable.clientMembershipId, membershipId), eq(clientMembershipUsageTable.serviceId, parsed.data.serviceId)));
  if (used.length >= included.quantity) {
    res.status(409).json({ error: "No remaining uses for this service" });
    return;
  }

  await db.insert(clientMembershipUsageTable).values({
    clientMembershipId: membershipId,
    serviceId: parsed.data.serviceId,
    notes: parsed.data.notes,
  });

  res.json({ success: true, remaining: included.quantity - used.length - 1 });
});

router.get("/memberships/sales", async (_req, res): Promise<void> => {
  const sales = await db
    .select()
    .from(clientMembershipsTable)
    .leftJoin(clientsTable, eq(clientMembershipsTable.clientId, clientsTable.id))
    .leftJoin(membershipPlansTable, eq(clientMembershipsTable.planId, membershipPlansTable.id))
    .orderBy(desc(clientMembershipsTable.purchasedAt));

  const today = new Date().toISOString().split("T")[0];

  res.json(sales.map((row) => {
    const m = row.client_memberships;
    const status = m.status === "cancelled" ? "cancelled" : m.expiryDate < today ? "expired" : "active";
    return {
      id: m.id,
      clientId: m.clientId,
      clientName: row.clients?.name ?? "Unknown",
      planId: m.planId,
      planName: row.membership_plans?.name ?? "Unknown",
      amountPaid: Number(m.amountPaid),
      paymentMethod: m.paymentMethod,
      startDate: m.startDate,
      expiryDate: m.expiryDate,
      status,
      purchasedAt: m.purchasedAt.toISOString(),
    };
  }));
});

export default router;
