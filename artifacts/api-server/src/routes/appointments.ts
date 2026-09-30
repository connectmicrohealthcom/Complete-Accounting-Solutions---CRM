import { Router, type IRouter } from "express";
import { eq, and, gte, lte, desc, or, ilike, inArray } from "drizzle-orm";
import {
  db,
  appointmentsTable,
  staffTable,
  clientsTable,
  servicesTable,
  serviceCategoriesTable,
  salesTable,
} from "@workspace/db";
import { z } from "zod/v4";
import {
  CreateAppointmentBody,
  UpdateAppointmentBody,
  GetAppointmentParams,
  UpdateAppointmentParams,
  DeleteAppointmentParams,
  UpdateAppointmentStatusParams,
  UpdateAppointmentStatusBody,
  ListAppointmentsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const SummaryQueryParams = z.object({
  from: z.string(),
  to: z.string(),
});

const EnhancedListParams = z.object({
  date: z.string().optional(),
  staffId: z.coerce.number().int().optional(),
  clientId: z.coerce.number().int().optional(),
  serviceId: z.coerce.number().int().optional(),
  status: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
  paymentMethod: z.string().optional(),
});

async function buildAppointmentResponse(appt: typeof appointmentsTable.$inferSelect) {
  const [[client], [staff], [service]] = await Promise.all([
    db.select().from(clientsTable).where(eq(clientsTable.id, appt.clientId)),
    db.select().from(staffTable).where(eq(staffTable.id, appt.staffId)),
    db.select().from(servicesTable).where(eq(servicesTable.id, appt.serviceId)),
  ]);

  let category = null;
  if (service?.categoryId) {
    const [cat] = await db
      .select()
      .from(serviceCategoriesTable)
      .where(eq(serviceCategoriesTable.id, service.categoryId));
    category = cat ?? null;
  }

  const [sale] = await db
    .select()
    .from(salesTable)
    .where(eq(salesTable.appointmentId, appt.id))
    .limit(1);

  return {
    ...appt,
    clientName: client?.name ?? "Unknown",
    clientPhone: client?.phone ?? null,
    staffName: staff?.name ?? "Unknown",
    staffColor: staff?.color ?? null,
    serviceName: service?.name ?? "Unknown",
    serviceCategoryName: category?.name ?? null,
    serviceDuration: service?.duration ?? 60,
    totalPrice: Number(appt.totalPrice),
    paymentMethod: sale?.paymentMethod ?? null,
    saleId: sale?.id ?? null,
    createdAt: appt.createdAt.toISOString(),
  };
}

// Summary analytics endpoint — must come before /:id routes
router.get("/appointments/summary", async (req, res): Promise<void> => {
  const parsed = SummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "from and to date params are required" });
    return;
  }
  const { from, to } = parsed.data;

  const appts = await db
    .select()
    .from(appointmentsTable)
    .where(and(gte(appointmentsTable.date, from), lte(appointmentsTable.date, to)));

  if (appts.length === 0) {
    res.json({
      totals: {
        total: 0, completed: 0, cancelled: 0, noShow: 0, pending: 0,
        confirmed: 0, inProgress: 0, totalRevenue: 0, avgRevenue: 0,
        newClients: 0, returningClients: 0,
      },
      byStatus: [],
      byDayHour: [],
      byStaff: [],
      byCategory: [],
      topServicesByCount: [],
      topServicesByRevenue: [],
      topStaffByCompleted: [],
    });
    return;
  }

  // Enrich with joins
  const [allStaff, allServices, allCategories] = await Promise.all([
    db.select().from(staffTable),
    db.select().from(servicesTable),
    db.select().from(serviceCategoriesTable),
  ]);

  const staffMap = new Map(allStaff.map(s => [s.id, s]));
  const serviceMap = new Map(allServices.map(s => [s.id, s]));
  const categoryMap = new Map(allCategories.map(c => [c.id, c]));

  // Determine new vs returning clients
  const periodClientIds = [...new Set(appts.map(a => a.clientId))];
  let returningClientIds = new Set<number>();

  if (periodClientIds.length > 0) {
    const priorAppts = await db
      .select({ clientId: appointmentsTable.clientId })
      .from(appointmentsTable)
      .where(
        and(
          inArray(appointmentsTable.clientId, periodClientIds),
          lte(appointmentsTable.date, from)
        )
      );
    returningClientIds = new Set(priorAppts.map(a => a.clientId));
  }

  const newClientSet = new Set(periodClientIds.filter(id => !returningClientIds.has(id)));

  // Aggregate totals
  let totalRevenue = 0;
  const statusCounts: Record<string, number> = {};
  const staffStats: Record<number, { staffId: number; staffName: string; count: number; completed: number; revenue: number }> = {};
  const categoryStats: Record<string, { categoryName: string; count: number }> = {};
  const serviceStats: Record<number, { serviceId: number; serviceName: string; count: number; revenue: number }> = {};
  const heatmap: Record<string, number> = {};

  for (const appt of appts) {
    const status = appt.status;
    statusCounts[status] = (statusCounts[status] ?? 0) + 1;

    const price = Number(appt.totalPrice);
    if (status === "completed") totalRevenue += price;

    // Staff stats
    const staff = staffMap.get(appt.staffId);
    const staffName = staff?.name ?? "Unknown";
    if (!staffStats[appt.staffId]) {
      staffStats[appt.staffId] = { staffId: appt.staffId, staffName, count: 0, completed: 0, revenue: 0 };
    }
    staffStats[appt.staffId].count++;
    if (status === "completed") {
      staffStats[appt.staffId].completed++;
      staffStats[appt.staffId].revenue += price;
    }

    // Service stats
    const service = serviceMap.get(appt.serviceId);
    if (service) {
      if (!serviceStats[appt.serviceId]) {
        serviceStats[appt.serviceId] = { serviceId: appt.serviceId, serviceName: service.name, count: 0, revenue: 0 };
      }
      serviceStats[appt.serviceId].count++;
      if (status === "completed") serviceStats[appt.serviceId].revenue += price;

      // Category stats
      const category = service.categoryId ? categoryMap.get(service.categoryId) : null;
      const catName = category?.name ?? "Uncategorized";
      if (!categoryStats[catName]) categoryStats[catName] = { categoryName: catName, count: 0 };
      categoryStats[catName].count++;
    }

    // Heatmap: day of week (0=Sun) + hour
    const dateObj = new Date(appt.date + "T" + appt.startTime);
    const dow = dateObj.getDay(); // 0-6
    const hour = parseInt(appt.startTime.split(":")[0], 10);
    const key = `${dow}-${hour}`;
    heatmap[key] = (heatmap[key] ?? 0) + 1;
  }

  const completedAppts = appts.filter(a => a.status === "completed");
  const avgRevenue = completedAppts.length > 0 ? totalRevenue / completedAppts.length : 0;

  const byDayHour = Object.entries(heatmap).map(([key, count]) => {
    const [dow, hr] = key.split("-").map(Number);
    return { dayOfWeek: dow, hour: hr, count };
  });

  const serviceList = Object.values(serviceStats);
  const topServicesByCount = [...serviceList].sort((a, b) => b.count - a.count).slice(0, 5);
  const topServicesByRevenue = [...serviceList].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const staffList = Object.values(staffStats);
  const topStaffByCompleted = [...staffList].sort((a, b) => b.completed - a.completed).slice(0, 5);

  res.json({
    totals: {
      total: appts.length,
      completed: statusCounts["completed"] ?? 0,
      cancelled: statusCounts["cancelled"] ?? 0,
      noShow: statusCounts["no_show"] ?? 0,
      pending: statusCounts["pending"] ?? 0,
      confirmed: statusCounts["confirmed"] ?? 0,
      inProgress: statusCounts["in_progress"] ?? 0,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgRevenue: Math.round(avgRevenue * 100) / 100,
      newClients: newClientSet.size,
      returningClients: returningClientIds.size,
    },
    byStatus: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
    byDayHour,
    byStaff: staffList.sort((a, b) => b.count - a.count),
    byCategory: Object.values(categoryStats).sort((a, b) => b.count - a.count),
    topServicesByCount,
    topServicesByRevenue,
    topStaffByCompleted,
  });
});

router.get("/appointments", async (req, res): Promise<void> => {
  const query = EnhancedListParams.safeParse(req.query);
  if (!query.success) { res.status(400).json({ error: query.error.message }); return; }

  const { date, staffId, clientId, serviceId, status, from, to, search, paymentMethod } = query.data;

  // If search is provided, find matching client IDs first
  let searchClientIds: number[] | null = null;
  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    const matchingClients = await db
      .select({ id: clientsTable.id })
      .from(clientsTable)
      .where(or(ilike(clientsTable.name, term), ilike(clientsTable.phone ?? "", term)));
    searchClientIds = matchingClients.map(c => c.id);
    if (searchClientIds.length === 0) {
      res.json([]);
      return;
    }
  }

  // If paymentMethod filter, find appointment IDs from sales
  let paymentApptIds: number[] | null = null;
  if (paymentMethod) {
    const matchingSales = await db
      .select({ appointmentId: salesTable.appointmentId })
      .from(salesTable)
      .where(eq(salesTable.paymentMethod, paymentMethod as any));
    paymentApptIds = matchingSales
      .map(s => s.appointmentId)
      .filter((id): id is number => id !== null);
    if (paymentApptIds.length === 0) {
      res.json([]);
      return;
    }
  }

  const conditions = [];
  if (date) conditions.push(eq(appointmentsTable.date, date));
  if (staffId) conditions.push(eq(appointmentsTable.staffId, staffId));
  if (clientId) conditions.push(eq(appointmentsTable.clientId, clientId));
  if (serviceId) conditions.push(eq(appointmentsTable.serviceId, serviceId));
  if (status) conditions.push(eq(appointmentsTable.status, status as any));
  if (from) conditions.push(gte(appointmentsTable.date, from));
  if (to) conditions.push(lte(appointmentsTable.date, to));
  if (searchClientIds) conditions.push(inArray(appointmentsTable.clientId, searchClientIds));
  if (paymentApptIds) conditions.push(inArray(appointmentsTable.id, paymentApptIds));

  let q = db.select().from(appointmentsTable).$dynamic();
  if (conditions.length > 0) q = q.where(and(...conditions));

  const appts = await q.orderBy(desc(appointmentsTable.date), appointmentsTable.startTime);
  const result = await Promise.all(appts.map(buildAppointmentResponse));
  res.json(result);
});

router.post("/appointments", async (req, res): Promise<void> => {
  const parsed = CreateAppointmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, parsed.data.serviceId));
  if (!service) { res.status(404).json({ error: "Service not found" }); return; }

  const startParts = parsed.data.startTime.split(":").map(Number);
  const startMinutes = startParts[0] * 60 + startParts[1];
  const endMinutes = startMinutes + service.duration;
  const endTime = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;

  const [appt] = await db
    .insert(appointmentsTable)
    .values({ ...parsed.data, endTime, totalPrice: String(service.price) })
    .returning();

  const result = await buildAppointmentResponse(appt);
  res.status(201).json(result);
});

router.get("/appointments/:id", async (req, res): Promise<void> => {
  const params = GetAppointmentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const [appt] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.id, params.data.id));
  if (!appt) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildAppointmentResponse(appt));
});

router.patch("/appointments/:id", async (req, res): Promise<void> => {
  const params = UpdateAppointmentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateAppointmentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [appt] = await db.update(appointmentsTable).set(parsed.data).where(eq(appointmentsTable.id, params.data.id)).returning();
  if (!appt) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildAppointmentResponse(appt));
});

router.delete("/appointments/:id", async (req, res): Promise<void> => {
  const params = DeleteAppointmentParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  await db.delete(appointmentsTable).where(eq(appointmentsTable.id, params.data.id));
  res.sendStatus(204);
});

router.patch("/appointments/:id/status", async (req, res): Promise<void> => {
  const params = UpdateAppointmentStatusParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }

  const parsed = UpdateAppointmentStatusBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [appt] = await db.update(appointmentsTable).set({ status: parsed.data.status }).where(eq(appointmentsTable.id, params.data.id)).returning();
  if (!appt) { res.status(404).json({ error: "Not found" }); return; }
  res.json(await buildAppointmentResponse(appt));
});

export default router;
