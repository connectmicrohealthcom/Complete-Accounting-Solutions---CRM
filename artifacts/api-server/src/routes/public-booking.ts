import { Router, type IRouter } from "express";
import { and, eq, inArray, or } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, appointmentsTable, clientsTable, servicesTable, serviceCategoriesTable, staffTable, workingHoursTable } from "@workspace/db";
import { z } from "zod/v4";
import { createBookingCheckout, isMockPaymentMode, verifyStripeSignature } from "../services/payments";
import { validateBooking } from "./appointments";

const router: IRouter = Router();
const ACTIVE_BOOKING_STATUSES = ["pending", "confirmed", "in_progress"] as const;

const BookingBody = z.object({
  name: z.string().trim().min(2).max(120),
  phone: z.string().trim().min(7).max(30),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  serviceId: z.coerce.number().int().positive(),
  staffId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
});

const AvailabilityQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  serviceId: z.coerce.number().int().positive(),
  staffId: z.coerce.number().int().positive().optional(),
});

function businessNow(): Date {
  const offset = Number(process.env.BUSINESS_TIMEZONE_OFFSET_MINUTES ?? "240");
  return new Date(Date.now() + (Number.isFinite(offset) ? offset : 240) * 60_000);
}
function dateKey(date: Date): string { return date.toISOString().slice(0, 10); }
function parseTime(value: string): number {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}
function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
function appointmentDateTimeUtc(date: string, time: string): Date {
  const offset = Number(process.env.BUSINESS_TIMEZONE_OFFSET_MINUTES ?? "240");
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) - offset * 60_000);
}

async function getAvailableSlots(date: string, serviceId: number, staffId?: number) {
  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, serviceId));
  if (!service || !service.isActive) return null;
  const staffRows = await db.select().from(staffTable).where(and(eq(staffTable.isActive, true), staffId ? eq(staffTable.id, staffId) : undefined));
  const results = await Promise.all(staffRows.map(async staff => {
    const [schedule] = await db.select().from(workingHoursTable).where(and(
      eq(workingHoursTable.staffId, staff.id),
      eq(workingHoursTable.dayOfWeek, new Date(`${date}T12:00:00Z`).getUTCDay()),
    ));
    if (!schedule || !schedule.isWorking) return null;
    const appointments = await db.select({ startTime: appointmentsTable.startTime, endTime: appointmentsTable.endTime })
      .from(appointmentsTable).where(and(
        eq(appointmentsTable.staffId, staff.id),
        eq(appointmentsTable.date, date),
        inArray(appointmentsTable.status, [...ACTIVE_BOOKING_STATUSES]),
      ));
    const blocked = appointments.map(a => [parseTime(a.startTime), parseTime(a.endTime)] as const);
    const start = parseTime(schedule.startTime);
    const end = parseTime(schedule.endTime);
    const now = businessNow();
    const minimumToday = dateKey(now) === date ? now.getUTCHours() * 60 + now.getUTCMinutes() + 15 : 0;
    const slots: string[] = [];
    for (let cursor = start; cursor + service.duration <= end; cursor += 15) {
      if (cursor < minimumToday) continue;
      const slotEnd = cursor + service.duration;
      if (blocked.some(([blockedStart, blockedEnd]) => cursor < blockedEnd && slotEnd > blockedStart)) continue;
      slots.push(formatTime(cursor));
    }
    return { staffId: staff.id, staffName: staff.name, staffColor: staff.color, slots };
  }));
  return results.filter(Boolean);
}

router.get("/public/booking/services", async (_req, res): Promise<void> => {
  const services = await db.select({
    id: servicesTable.id, name: servicesTable.name, description: servicesTable.description,
    categoryId: servicesTable.categoryId, categoryName: serviceCategoriesTable.name,
    duration: servicesTable.duration, price: servicesTable.price,
  }).from(servicesTable)
    .leftJoin(serviceCategoriesTable, eq(servicesTable.categoryId, serviceCategoriesTable.id))
    .where(eq(servicesTable.isActive, true));
  res.json(services.map(service => ({ ...service, price: Number(service.price) })));
});

router.get("/public/booking/availability", async (req, res): Promise<void> => {
  const parsed = AvailabilityQuery.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "date and serviceId are required" }); return; }
  if (parsed.data.date < dateKey(businessNow())) { res.status(400).json({ error: "Booking date cannot be in the past" }); return; }
  const slots = await getAvailableSlots(parsed.data.date, parsed.data.serviceId, parsed.data.staffId);
  if (slots === null) { res.status(404).json({ error: "Service not found" }); return; }
  res.json({ date: parsed.data.date, serviceId: parsed.data.serviceId, staff: slots });
});

router.post("/public/booking", async (req, res): Promise<void> => {
  const parsed = BookingBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const data = parsed.data;
  const today = dateKey(businessNow());
  if (data.date < today) { res.status(400).json({ error: "Booking date cannot be in the past" }); return; }
  if (data.date === today && appointmentDateTimeUtc(data.date, data.startTime).getTime() <= Date.now()) {
    res.status(400).json({ error: "Booking time must be in the future" }); return;
  }

  const validation = await validateBooking({ staffId: data.staffId, serviceId: data.serviceId, date: data.date, startTime: data.startTime });
  if (!validation.ok) { res.status(validation.status).json({ error: validation.error }); return; }
  const [service] = await db.select().from(servicesTable).where(eq(servicesTable.id, data.serviceId));
  if (!service) { res.status(404).json({ error: "Service not found" }); return; }

  const clientConditions = data.email
    ? or(eq(clientsTable.phone, data.phone), eq(clientsTable.email, data.email))
    : eq(clientsTable.phone, data.phone);
  const existingClient = await db.select().from(clientsTable).where(clientConditions).limit(1);
  let clientId = existingClient[0]?.id;
  if (!clientId) {
    const [client] = await db.insert(clientsTable).values({ name: data.name, phone: data.phone, email: data.email || null }).returning({ id: clientsTable.id });
    clientId = client.id;
  }

  const publicToken = randomBytes(24).toString("hex");
  const [appointment] = await db.insert(appointmentsTable).values({
    clientId, staffId: data.staffId, serviceId: data.serviceId, date: data.date, startTime: data.startTime,
    endTime: validation.endTime, totalPrice: String(validation.totalPrice), notes: "Online booking",
    bookingSource: "online", paymentStatus: "pending", publicToken, status: "pending",
  }).returning();

  const publicBase = process.env.PUBLIC_BOOKING_URL ?? "https://personal-crm-cas.vercel.app/book";
  const successUrl = `${publicBase}?booking=${publicToken}&payment=success`;
  const cancelUrl = `${publicBase}?booking=${publicToken}&payment=cancelled`;

  try {
    const checkout = await createBookingCheckout({
      appointmentId: appointment.id, serviceName: service.name, amountAed: validation.totalPrice,
      customerEmail: data.email || null, successUrl, cancelUrl,
    });
    const finalStatus = isMockPaymentMode() ? "confirmed" : "pending";
    const finalPaymentStatus = isMockPaymentMode() ? "paid" : "pending";
    await db.update(appointmentsTable).set({
      status: finalStatus, paymentStatus: finalPaymentStatus, paymentProvider: checkout.provider, paymentReference: checkout.id,
    }).where(eq(appointmentsTable.id, appointment.id));
    res.status(201).json({
      bookingToken: publicToken, appointmentId: appointment.id, status: finalStatus,
      paymentStatus: finalPaymentStatus, paymentUrl: checkout.url,
    });
  } catch (error) {
    await db.update(appointmentsTable).set({ status: "cancelled", paymentStatus: "failed" }).where(eq(appointmentsTable.id, appointment.id));
    res.status(502).json({ error: error instanceof Error ? error.message : "Payment gateway unavailable" });
  }
});

router.get("/public/booking/:token", async (req, res): Promise<void> => {
  const [appointment] = await db.select().from(appointmentsTable).where(eq(appointmentsTable.publicToken, req.params.token));
  if (!appointment) { res.status(404).json({ error: "Booking not found" }); return; }
  const [[client], [staff], [service]] = await Promise.all([
    db.select({ name: clientsTable.name }).from(clientsTable).where(eq(clientsTable.id, appointment.clientId)),
    db.select({ name: staffTable.name }).from(staffTable).where(eq(staffTable.id, appointment.staffId)),
    db.select({ name: servicesTable.name }).from(servicesTable).where(eq(servicesTable.id, appointment.serviceId)),
  ]);
  res.json({
    appointmentId: appointment.id, status: appointment.status, paymentStatus: appointment.paymentStatus,
    date: appointment.date, startTime: appointment.startTime, endTime: appointment.endTime,
    totalPrice: Number(appointment.totalPrice), clientName: client?.name ?? null,
    staffName: staff?.name ?? null, serviceName: service?.name ?? null,
  });
});

router.post("/public/booking/payment/webhook", async (req, res): Promise<void> => {
  const rawBody = (req as any).rawBody as Buffer | undefined;
  if (!rawBody || !verifyStripeSignature(rawBody, req.header("stripe-signature"))) {
    res.status(400).json({ error: "Invalid payment webhook signature" }); return;
  }
  const event = JSON.parse(rawBody.toString("utf8")) as {
    type?: string;
    data?: { object?: { id?: string; client_reference_id?: string; metadata?: { appointmentId?: string } } };
  };
  const object = event.data?.object;
  const appointmentId = Number(object?.metadata?.appointmentId ?? object?.client_reference_id);
  if (!Number.isInteger(appointmentId) || appointmentId <= 0) {
    res.status(400).json({ error: "Webhook has no valid appointment reference" }); return;
  }
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type ?? "")) {
    await db.update(appointmentsTable).set({
      status: "confirmed", paymentStatus: "paid", paymentProvider: "stripe", paymentReference: object?.id ?? null,
    }).where(eq(appointmentsTable.id, appointmentId));
  } else if (["checkout.session.async_payment_failed", "checkout.session.expired"].includes(event.type ?? "")) {
    await db.update(appointmentsTable).set({
      status: "cancelled", paymentStatus: "failed", paymentProvider: "stripe", paymentReference: object?.id ?? null,
    }).where(eq(appointmentsTable.id, appointmentId));
  }
  res.json({ received: true });
});

export default router;
