import { eq } from "drizzle-orm";
import { db, staffTable, workingHoursTable, servicesTable, clientsTable, appointmentsTable, notificationsTable } from "@workspace/db";
import { runAutomationCycle } from "./stage2-automation";

const base = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:5001";
async function request(path: string, options?: RequestInit) {
  const response = await fetch(`${base}${path}`, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${path} ${response.status}: ${JSON.stringify(data)}`);
  return data as any;
}
function localDate(offsetMinutes = 240) {
  return new Date(Date.now() + offsetMinutes * 60_000).toISOString().slice(0, 10);
}

async function main() {
  const suffix = Date.now();
  const staff = (await db.insert(staffTable).values({
    name: `Stage2 Staff ${suffix}`, email: `stage2-staff-${suffix}@test.local`, passwordHash: "not-used", role: "stylist", isActive: true,
  }).returning())[0];
  const service = (await db.insert(servicesTable).values({
    name: `Stage2 Service ${suffix}`, duration: 60, price: "125", isActive: true,
  }).returning())[0];
  await db.insert(workingHoursTable).values(Array.from({ length: 7 }, (_, dayOfWeek) => ({
    staffId: staff.id, dayOfWeek, startTime: "09:00", endTime: "18:00", isWorking: true,
  })));

  const services = await request("/api/public/booking/services");
  if (!services.some((item: any) => item.id === service.id)) throw new Error("Public service catalogue did not expose active service");

  const tomorrow = new Date(Date.now() + 36 * 60 * 60 * 1000);
  const bookingDate = new Date(tomorrow.getTime() + 240 * 60_000).toISOString().slice(0, 10);
  const availability = await request(`/api/public/booking/availability?serviceId=${service.id}&date=${bookingDate}`);
  const staffAvailability = availability.staff.find((item: any) => item.staffId === staff.id);
  if (!staffAvailability?.slots.includes("10:00")) throw new Error("Expected 10:00 booking slot was not available");

  const booking = await request("/api/public/booking", {
    method: "POST",
    body: JSON.stringify({
      name: `Stage2 Client ${suffix}`, phone: `971500${String(suffix).slice(-6)}`,
      email: `stage2-client-${suffix}@test.local`, serviceId: service.id, staffId: staff.id, date: bookingDate, startTime: "10:00",
    }),
  });
  if (booking.status !== "confirmed" || booking.paymentStatus !== "paid" || !booking.bookingToken) throw new Error(`Mock payment booking state invalid: ${JSON.stringify(booking)}`);

  const bookingStatus = await request(`/api/public/booking/${booking.bookingToken}`);
  if (bookingStatus.status !== "confirmed" || bookingStatus.paymentStatus !== "paid") throw new Error("Public booking status did not reflect paid confirmation");

  const client = (await db.select().from(clientsTable).where(eq(clientsTable.email, `stage2-client-${suffix}@test.local`)).limit(1))[0];
  if (!client) throw new Error("Public booking did not create/find client");
  await db.insert(notificationsTable).values({
    type: "appointment_reminder", appointmentId: booking.appointmentId, clientId: client.id,
    scheduledFor: new Date(Date.now() - 60_000), provider: "mock",
    payload: { clientName: client.name, phone: client.phone, date: bookingDate, time: "10:00" },
  });
  const birthdayClient = (await db.insert(clientsTable).values({
    name: `Stage2 Birthday ${suffix}`, phone: `971501${String(suffix).slice(-6)}`, dateOfBirth: localDate(),
  }).returning())[0];

  const automation = await runAutomationCycle();
  if (automation.sent < 2) throw new Error(`Automation did not send expected mock notifications: ${JSON.stringify(automation)}`);

  await db.delete(notificationsTable).where(eq(notificationsTable.clientId, birthdayClient.id));
  await db.delete(notificationsTable).where(eq(notificationsTable.clientId, client.id));
  await db.delete(appointmentsTable).where(eq(appointmentsTable.id, booking.appointmentId));
  await db.delete(clientsTable).where(eq(clientsTable.id, birthdayClient.id));
  await db.delete(clientsTable).where(eq(clientsTable.id, client.id));
  await db.delete(workingHoursTable).where(eq(workingHoursTable.staffId, staff.id));
  await db.delete(servicesTable).where(eq(servicesTable.id, service.id));
  await db.delete(staffTable).where(eq(staffTable.id, staff.id));

  console.log("STAGE2_SMOKE_PASS");
}
main().catch(error => { console.error(error); process.exit(1); });
