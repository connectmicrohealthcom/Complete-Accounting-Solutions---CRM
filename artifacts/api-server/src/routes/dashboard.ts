import { Router, type IRouter } from "express";
import { eq, gte, lte, and, sql, desc } from "drizzle-orm";
import { db, appointmentsTable, clientsTable, salesTable, productsTable, saleItemsTable, servicesTable, staffTable } from "@workspace/db";
import { GetRevenueChartQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const monthStart = today.slice(0, 7) + "-01";

  const [
    todayAppts,
    totalClients,
    monthSales,
    todaySales,
    lowStock,
    newClientsToday,
  ] = await Promise.all([
    db.select().from(appointmentsTable).where(eq(appointmentsTable.date, today)),
    db.select({ count: sql<number>`count(*)` }).from(clientsTable),
    db.select().from(salesTable).where(gte(salesTable.createdAt, new Date(monthStart))),
    db.select().from(salesTable).where(gte(salesTable.createdAt, new Date(today))),
    db.select().from(productsTable).where(sql`stock_quantity <= low_stock_threshold`),
    db.select({ count: sql<number>`count(*)` }).from(clientsTable).where(gte(clientsTable.createdAt, new Date(today))),
  ]);

  const todayRevenue = todaySales.reduce((s, x) => s + Number(x.total), 0);
  const monthRevenue = monthSales.reduce((s, x) => s + Number(x.total), 0);
  const completedToday = todayAppts.filter((a) => a.status === "completed").length;
  const pendingAppointments = todayAppts.filter((a) => ["pending", "confirmed"].includes(a.status)).length;

  res.json({
    todayRevenue,
    todayAppointments: todayAppts.length,
    completedToday,
    newClients: Number(newClientsToday[0]?.count ?? 0),
    totalClients: Number(totalClients[0]?.count ?? 0),
    pendingAppointments,
    lowStockCount: lowStock.length,
    monthRevenue,
    monthAppointments: monthSales.length,
  });
});

router.get("/dashboard/revenue-chart", async (req, res): Promise<void> => {
  const query = GetRevenueChartQueryParams.safeParse(req.query);
  const period = query.data?.period ?? "week";

  const sales = await db.select().from(salesTable).orderBy(salesTable.createdAt);
  const appts = await db.select().from(appointmentsTable);

  const points: { label: string; revenue: number; appointments: number }[] = [];

  if (period === "week") {
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const label = d.toLocaleDateString("en-US", { weekday: "short" });
      const revenue = sales.filter((s) => s.createdAt.toISOString().split("T")[0] === dateStr).reduce((s, x) => s + Number(x.total), 0);
      const appointments = appts.filter((a) => a.date === dateStr).length;
      points.push({ label, revenue, appointments });
    }
  } else if (period === "month") {
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const label = String(d.getDate());
      const revenue = sales.filter((s) => s.createdAt.toISOString().split("T")[0] === dateStr).reduce((s, x) => s + Number(x.total), 0);
      const appointments = appts.filter((a) => a.date === dateStr).length;
      points.push({ label, revenue, appointments });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const monthStr = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString("en-US", { month: "short" });
      const revenue = sales.filter((s) => s.createdAt.toISOString().slice(0, 7) === monthStr).reduce((s, x) => s + Number(x.total), 0);
      const appointments = appts.filter((a) => a.date.slice(0, 7) === monthStr).length;
      points.push({ label, revenue, appointments });
    }
  }

  res.json(points);
});

router.get("/dashboard/top-services", async (_req, res): Promise<void> => {
  const items = await db
    .select({
      serviceId: saleItemsTable.referenceId,
      name: saleItemsTable.name,
      count: sql<number>`count(*)`,
      revenue: sql<number>`sum(${saleItemsTable.totalPrice})`,
    })
    .from(saleItemsTable)
    .where(eq(saleItemsTable.type, "service"))
    .groupBy(saleItemsTable.referenceId, saleItemsTable.name)
    .orderBy(sql`sum(${saleItemsTable.totalPrice}) desc`)
    .limit(5);

  res.json(items.map((i) => ({
    serviceId: i.serviceId ?? 0,
    serviceName: i.name,
    count: Number(i.count),
    revenue: Number(i.revenue),
  })));
});

router.get("/dashboard/upcoming-appointments", async (_req, res): Promise<void> => {
  const today = new Date().toISOString().split("T")[0];
  const appts = await db
    .select()
    .from(appointmentsTable)
    .where(and(eq(appointmentsTable.date, today), sql`status IN ('pending', 'confirmed')`))
    .orderBy(appointmentsTable.startTime)
    .limit(10);

  const result = await Promise.all(
    appts.map(async (a) => {
      const [[client], [staff], [service]] = await Promise.all([
        db.select().from(clientsTable).where(eq(clientsTable.id, a.clientId)),
        db.select().from(staffTable).where(eq(staffTable.id, a.staffId)),
        db.select().from(servicesTable).where(eq(servicesTable.id, a.serviceId)),
      ]);
      return {
        ...a,
        clientName: client?.name ?? "Unknown",
        staffName: staff?.name ?? "Unknown",
        staffColor: staff?.color ?? null,
        serviceName: service?.name ?? "Unknown",
        totalPrice: Number(a.totalPrice),
        createdAt: a.createdAt.toISOString(),
      };
    })
  );

  res.json(result);
});

export default router;
