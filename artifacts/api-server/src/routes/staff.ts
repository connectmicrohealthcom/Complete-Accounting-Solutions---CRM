import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import {
  db, staffTable, workingHoursTable, appointmentsTable, salesTable, saleItemsTable,
  tipsTable, attendanceLogsTable, staffWageSettingsTable, wagePaymentsTable, commissionSlabsTable,
} from "@workspace/db";
import bcrypt from "bcryptjs";
import {
  CreateStaffBody, UpdateStaffBody, GetStaffParams, UpdateStaffParams, DeleteStaffParams,
  GetStaffScheduleParams, UpdateStaffScheduleParams, UpdateStaffScheduleBody, FetchStaffPerformanceParams,
} from "@workspace/api-zod";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

function parseTime(value: string): number | null {
  const match = /^(\\d{2}):(\\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

function formatStaff(s: typeof staffTable.$inferSelect) {
  const { passwordHash: _ph, ...safe } = s;
  return {
    ...safe,
    commissionRate: safe.commissionRate ? Number(safe.commissionRate) : null,
    targetMonthly: safe.targetMonthly ? Number(safe.targetMonthly) : null,
  };
}

// ─── CRUD ─────────────────────────────────────────────────────────────────────

router.get("/staff", async (_req, res): Promise<void> => {
  const staff = await db.select().from(staffTable).orderBy(staffTable.name);
  res.json(staff.map(formatStaff));
});

router.post("/staff", async (req, res): Promise<void> => {
  const parsed = CreateStaffBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { password, commissionRate, targetMonthly, ...rest } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  const [staff] = await db.insert(staffTable).values({
    ...rest,
    passwordHash,
    commissionRate: commissionRate != null ? String(commissionRate) : null,
    targetMonthly: targetMonthly != null ? String(targetMonthly) : null,
  }).returning();
  res.status(201).json(formatStaff(staff));
});

router.get("/staff/:id", async (req, res): Promise<void> => {
  const params = GetStaffParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, params.data.id));
  if (!staff) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatStaff(staff));
});

router.patch("/staff/:id", async (req, res): Promise<void> => {
  const params = UpdateStaffParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateStaffBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const { commissionRate: cr, targetMonthly: tm, ...updateRest } = parsed.data;
  const [staff] = await db.update(staffTable).set({
    ...updateRest,
    ...(cr != null ? { commissionRate: String(cr) } : {}),
    ...(tm != null ? { targetMonthly: String(tm) } : {}),
  }).where(eq(staffTable.id, params.data.id)).returning();
  if (!staff) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatStaff(staff));
});

router.delete("/staff/:id", async (req, res): Promise<void> => {
  const params = DeleteStaffParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(staffTable).where(eq(staffTable.id, params.data.id));
  res.sendStatus(204);
});

// ─── ATTENDANCE SCHEDULE (which days staff works — booking availability) ──────

router.get("/staff/:id/schedule", async (req, res): Promise<void> => {
  const params = GetStaffScheduleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const hours = await db.select().from(workingHoursTable)
    .where(eq(workingHoursTable.staffId, params.data.id))
    .orderBy(workingHoursTable.dayOfWeek);
  res.json(hours);
});

router.put("/staff/:id/schedule", async (req, res): Promise<void> => {
  const params = UpdateStaffScheduleParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const parsed = UpdateStaffScheduleBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const hours = parsed.data.hours;
  const days = hours.map(h => h.dayOfWeek);
  if (hours.length !== 7 || new Set(days).size !== 7 || days.some(d => d < 0 || d > 6)) {
    res.status(400).json({ error: "A complete schedule must contain exactly one entry for each day 0-6" });
    return;
  }
  for (const h of hours) {
    const start = parseTime(h.startTime);
    const end = parseTime(h.endTime);
    if (start == null || end == null) {
      res.status(400).json({ error: "Schedule times must use HH:MM" });
      return;
    }
    if (h.isWorking && start >= end) {
      res.status(400).json({ error: `Invalid working hours for day ${h.dayOfWeek}` });
      return;
    }
  }

  const [staff] = await db.select({ id: staffTable.id }).from(staffTable).where(eq(staffTable.id, params.data.id));
  if (!staff) { res.status(404).json({ error: "Staff member not found" }); return; }

  await db.delete(workingHoursTable).where(eq(workingHoursTable.staffId, params.data.id));
  const rows = hours.map((h) => ({ ...h, staffId: params.data.id }));
  const result = await db.insert(workingHoursTable).values(rows).returning();
  res.json(result);
});

// ─── PERFORMANCE ──────────────────────────────────────────────────────────────

router.get("/staff/:id/performance", async (req, res): Promise<void> => {
  const params = FetchStaffPerformanceParams.safeParse(req.params);
  if (!params.success) { res.status(400).json({ error: "Invalid id" }); return; }
  const staffId = params.data.id;

  const apptRows = await db.select().from(appointmentsTable).where(eq(appointmentsTable.staffId, staffId));
  const completed = apptRows.filter((a) => a.status === "completed");
  const totalRevenue = completed.reduce((sum, a) => sum + Number(a.totalPrice), 0);

  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId));
  const commissionRate = staff?.commissionRate ? Number(staff.commissionRate) : 0;
  const targetMonthly = staff?.targetMonthly ? Number(staff.targetMonthly) : 0;
  const commissionEarned = (totalRevenue * commissionRate) / 100;
  const targetProgress = targetMonthly > 0 ? (totalRevenue / targetMonthly) * 100 : 0;

  res.json({
    staffId,
    totalRevenue,
    totalAppointments: apptRows.length,
    completedAppointments: completed.length,
    commissionEarned,
    targetProgress: Math.round(targetProgress * 10) / 10,
    topServices: [],
  });
});

// ─── WORKING HOURS LOG (actual clock-in/clock-out per day) ───────────────────

router.get("/staff/:id/attendance-logs", async (req, res): Promise<void> => {
  const staffId = parseInt(req.params.id);
  const { from, to } = req.query as { from?: string; to?: string };
  const conditions: any[] = [eq(attendanceLogsTable.staffId, staffId)];
  if (from) conditions.push(gte(attendanceLogsTable.date, from));
  if (to) conditions.push(lte(attendanceLogsTable.date, to));
  const logs = await db.select().from(attendanceLogsTable).where(and(...conditions)).orderBy(attendanceLogsTable.date);
  res.json(logs.map((l) => ({ ...l, totalHours: l.totalHours ? Number(l.totalHours) : null })));
});

router.post("/staff/:id/attendance-logs", async (req, res): Promise<void> => {
  const staffId = parseInt(req.params.id);
  const { date, clockIn, clockOut, totalHours, notes } = req.body;
  if (!date) { res.status(400).json({ error: "date is required" }); return; }
  const [log] = await db.insert(attendanceLogsTable).values({
    staffId, date,
    clockIn: clockIn || null,
    clockOut: clockOut || null,
    totalHours: totalHours != null ? String(totalHours) : null,
    notes: notes || null,
  }).returning();
  res.status(201).json({ ...log, totalHours: log.totalHours ? Number(log.totalHours) : null });
});

router.delete("/staff/:id/attendance-logs/:logId", async (req, res): Promise<void> => {
  const staffId = parseInt(req.params.id);
  const logId = parseInt(req.params.logId);
  await db.delete(attendanceLogsTable).where(and(eq(attendanceLogsTable.id, logId), eq(attendanceLogsTable.staffId, staffId)));
  res.sendStatus(204);
});

// ─── WAGE SETTINGS ────────────────────────────────────────────────────────────

router.get("/staff/:id/wage-settings", async (req, res): Promise<void> => {
  const staffId = parseInt(req.params.id);
  const [settings] = await db.select().from(staffWageSettingsTable).where(eq(staffWageSettingsTable.staffId, staffId));
  res.json(settings ? { ...settings, baseAmount: Number(settings.baseAmount) } : null);
});

router.put("/staff/:id/wage-settings", async (req, res): Promise<void> => {
  const staffId = parseInt(req.params.id);
  const { wageType, baseAmount } = req.body;
  if (!wageType || baseAmount == null) { res.status(400).json({ error: "wageType and baseAmount required" }); return; }
  const existing = await db.select().from(staffWageSettingsTable).where(eq(staffWageSettingsTable.staffId, staffId));
  let result;
  if (existing.length > 0) {
    [result] = await db.update(staffWageSettingsTable)
      .set({ wageType, baseAmount: String(baseAmount) })
      .where(eq(staffWageSettingsTable.staffId, staffId))
      .returning();
  } else {
    [result] = await db.insert(staffWageSettingsTable).values({ staffId, wageType, baseAmount: String(baseAmount) }).returning();
  }
  res.json({ ...result, baseAmount: Number(result.baseAmount) });
});

// ─── WAGE PAYMENTS ────────────────────────────────────────────────────────────

router.get("/staff/:id/wage-payments", async (req, res): Promise<void> => {
  const staffId = parseInt(req.params.id);
  const payments = await db.select().from(wagePaymentsTable)
    .where(eq(wagePaymentsTable.staffId, staffId))
    .orderBy(wagePaymentsTable.paymentDate);
  res.json(payments.map((p) => ({ ...p, amount: Number(p.amount) })));
});

router.post("/staff/:id/wage-payments", async (req, res): Promise<void> => {
  const staffId = parseInt(req.params.id);
  const { amount, periodFrom, periodTo, paymentDate, paymentMethod, notes } = req.body;
  if (!amount || !periodFrom || !periodTo || !paymentDate) { res.status(400).json({ error: "Missing required fields" }); return; }
  const [payment] = await db.insert(wagePaymentsTable).values({
    staffId, amount: String(amount), periodFrom, periodTo, paymentDate,
    paymentMethod: paymentMethod || "cash", notes: notes || null,
  }).returning();
  res.status(201).json({ ...payment, amount: Number(payment.amount) });
});

// ─── COMMISSION SLABS ─────────────────────────────────────────────────────────

router.get("/staff/:id/commission-slabs", async (req, res): Promise<void> => {
  const staffId = parseInt(req.params.id);
  const slabs = await db.select().from(commissionSlabsTable)
    .where(eq(commissionSlabsTable.staffId, staffId))
    .orderBy(commissionSlabsTable.sortOrder);
  res.json(slabs.map((s) => ({
    ...s,
    minAmount: Number(s.minAmount),
    maxAmount: s.maxAmount != null ? Number(s.maxAmount) : null,
    rate: Number(s.rate),
  })));
});

router.post("/staff/:id/commission-slabs", async (req, res): Promise<void> => {
  const staffId = parseInt(req.params.id);
  const { minAmount, maxAmount, rate } = req.body;
  if (minAmount == null || rate == null) { res.status(400).json({ error: "minAmount and rate required" }); return; }
  const existing = await db.select().from(commissionSlabsTable).where(eq(commissionSlabsTable.staffId, staffId));
  const [slab] = await db.insert(commissionSlabsTable).values({
    staffId, minAmount: String(minAmount),
    maxAmount: maxAmount != null ? String(maxAmount) : null,
    rate: String(rate), sortOrder: existing.length,
  }).returning();
  res.status(201).json({ ...slab, minAmount: Number(slab.minAmount), maxAmount: slab.maxAmount != null ? Number(slab.maxAmount) : null, rate: Number(slab.rate) });
});

router.delete("/staff/:id/commission-slabs/:slabId", async (req, res): Promise<void> => {
  const staffId = parseInt(req.params.id);
  const slabId = parseInt(req.params.slabId);
  await db.delete(commissionSlabsTable).where(and(eq(commissionSlabsTable.id, slabId), eq(commissionSlabsTable.staffId, staffId)));
  res.sendStatus(204);
});

// ─── STAFF TIPS ───────────────────────────────────────────────────────────────

router.get("/staff/:id/tips", async (req, res): Promise<void> => {
  const staffId = parseInt(req.params.id);
  const { from, to } = req.query as { from?: string; to?: string };
  const conditions: any[] = [eq(tipsTable.staffId, staffId)];
  if (from) conditions.push(gte(tipsTable.createdAt, new Date(from)));
  if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); conditions.push(lte(tipsTable.createdAt, d)); }
  const tips = await db.select().from(tipsTable).where(and(...conditions)).orderBy(tipsTable.createdAt);
  res.json(tips.map((t) => ({ ...t, amount: Number(t.amount), createdAt: t.createdAt.toISOString() })));
});

// ─── FINANCIAL SUMMARY ────────────────────────────────────────────────────────

router.get("/staff/:id/financial-summary", async (req, res): Promise<void> => {
  const staffId = parseInt(req.params.id);
  const { from, to } = req.query as { from?: string; to?: string };

  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId));
  if (!staff) { res.status(404).json({ error: "Not found" }); return; }

  const buildDateConditions = (col: any) => {
    const c: any[] = [];
    if (from) c.push(gte(col, from));
    if (to) c.push(lte(col, to));
    return c;
  };

  const buildTsConditions = (col: any) => {
    const c: any[] = [];
    if (from) c.push(gte(col, new Date(from)));
    if (to) { const d = new Date(to); d.setHours(23, 59, 59, 999); c.push(lte(col, d)); }
    return c;
  };

  const salesCond = [eq(salesTable.staffId, staffId), ...buildTsConditions(salesTable.createdAt)];
  const salesRows = await db.select().from(salesTable).where(and(...salesCond));
  const totalSales = salesRows.reduce((s, r) => s + Number(r.total), 0);

  const tipsCond = [eq(tipsTable.staffId, staffId), ...buildTsConditions(tipsTable.createdAt)];
  const tipsRows = await db.select().from(tipsTable).where(and(...tipsCond));
  const tipsTotal = tipsRows.reduce((s, t) => s + Number(t.amount), 0);

  const attendCond = [eq(attendanceLogsTable.staffId, staffId), ...buildDateConditions(attendanceLogsTable.date)];
  const attendRows = await db.select().from(attendanceLogsTable).where(and(...attendCond));
  const totalHours = attendRows.reduce((s, l) => s + (Number(l.totalHours) || 0), 0);
  const daysWorked = attendRows.length;

  const [wageSettings] = await db.select().from(staffWageSettingsTable).where(eq(staffWageSettingsTable.staffId, staffId));
  let wagesDue = 0;
  if (wageSettings) {
    wagesDue = wageSettings.wageType === "monthly"
      ? Number(wageSettings.baseAmount)
      : totalHours * Number(wageSettings.baseAmount);
  }

  const paymentConditions: any[] = [eq(wagePaymentsTable.staffId, staffId)];
  if (from) paymentConditions.push(gte(wagePaymentsTable.paymentDate, from));
  if (to) paymentConditions.push(lte(wagePaymentsTable.paymentDate, to));
  const payments = await db.select().from(wagePaymentsTable).where(and(...paymentConditions));
  const wagesPaid = payments.reduce((s, p) => s + Number(p.amount), 0);
  const outstandingWages = Math.max(0, wagesDue + commissionEarned - wagesPaid);

  const slabs = await db.select().from(commissionSlabsTable)
    .where(eq(commissionSlabsTable.staffId, staffId))
    .orderBy(commissionSlabsTable.sortOrder);

  let commissionEarned = 0;
  let matchedSlab: { minAmount: number; maxAmount: number | null; rate: number } | null = null;

  if (slabs.length > 0) {
    for (const slab of slabs) {
      const min = Number(slab.minAmount);
      const max = slab.maxAmount != null ? Number(slab.maxAmount) : Infinity;
      if (totalSales >= min && totalSales <= max) {
        matchedSlab = { minAmount: min, maxAmount: slab.maxAmount != null ? Number(slab.maxAmount) : null, rate: Number(slab.rate) };
        commissionEarned = (totalSales * Number(slab.rate)) / 100;
        break;
      }
    }
    if (!matchedSlab && slabs.length > 0) {
      const last = slabs[slabs.length - 1];
      if (totalSales >= Number(last.minAmount)) {
        matchedSlab = { minAmount: Number(last.minAmount), maxAmount: null, rate: Number(last.rate) };
        commissionEarned = (totalSales * Number(last.rate)) / 100;
      }
    }
  } else if (staff.commissionRate) {
    commissionEarned = (totalSales * Number(staff.commissionRate)) / 100;
  }

  res.json({
    staffId,
    totalSales,
    commissionEarned: Math.round(commissionEarned * 100) / 100,
    commissionSlab: matchedSlab,
    tipsTotal,
    wagesDue: Math.round(wagesDue * 100) / 100,
    wagesPaid: Math.round(wagesPaid * 100) / 100,
    outstandingWages: Math.round(outstandingWages * 100) / 100,
    totalHours: Math.round(totalHours * 100) / 100,
    daysWorked,
    totalRevenue: Math.round(totalSales * 100) / 100,
    wagePaid: Math.round(wagesPaid * 100) / 100,
    netPayable: Math.round(outstandingWages * 100) / 100,
    totalHoursLogged: Math.round(totalHours * 100) / 100,
  });
});

export default router;
