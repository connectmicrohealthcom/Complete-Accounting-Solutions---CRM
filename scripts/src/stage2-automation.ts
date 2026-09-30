import { and, eq, gte, lte, or } from "drizzle-orm";
import { db, appointmentsTable, clientsTable, notificationsTable } from "@workspace/db";

const OFFSET_MINUTES = Number(process.env.BUSINESS_TIMEZONE_OFFSET_MINUTES ?? "240");
const NOTIFICATION_MODE = process.env.NOTIFICATION_MODE === "mock" ? "mock" : "whatsapp";
const GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? "v23.0";

function businessNow(): Date {
  return new Date(Date.now() + (Number.isFinite(OFFSET_MINUTES) ? OFFSET_MINUTES : 240) * 60_000);
}
function localDateKey(date: Date): string { return date.toISOString().slice(0, 10); }
function appointmentUtc(date: string, time: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, min) - OFFSET_MINUTES * 60_000);
}
function localDateTimeUtc(date: string, hour: number, minute: number): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hour, minute) - OFFSET_MINUTES * 60_000);
}
function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, "");
}

async function ensureNotification(input: {
  type: "appointment_reminder" | "birthday_outreach";
  appointmentId?: number;
  clientId: number;
  scheduledFor: Date;
  payload: Record<string, unknown>;
}) {
  const existing = await db.select({ id: notificationsTable.id })
    .from(notificationsTable)
    .where(and(
      eq(notificationsTable.type, input.type),
      eq(notificationsTable.clientId, input.clientId),
      input.appointmentId ? eq(notificationsTable.appointmentId, input.appointmentId) : eq(notificationsTable.clientId, input.clientId),
      eq(notificationsTable.scheduledFor, input.scheduledFor),
    )).limit(1);
  if (existing[0]) return false;
  await db.insert(notificationsTable).values({
    type: input.type,
    appointmentId: input.appointmentId ?? null,
    clientId: input.clientId,
    scheduledFor: input.scheduledFor,
    provider: NOTIFICATION_MODE,
    payload: input.payload,
  });
  return true;
}

async function scheduleAppointmentReminders(now: Date) {
  const start = localDateKey(businessNow());
  const endDate = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const end = localDateKey(new Date(endDate.getTime() + OFFSET_MINUTES * 60_000));
  const appointments = await db.select().from(appointmentsTable).where(and(
    gte(appointmentsTable.date, start),
    lte(appointmentsTable.date, end),
    eq(appointmentsTable.status, "confirmed"),
  ));

  for (const appointment of appointments) {
    const client = (await db.select().from(clientsTable).where(eq(clientsTable.id, appointment.clientId)).limit(1))[0];
    if (!client?.phone) continue;
    const appointmentAt = appointmentUtc(appointment.date, appointment.startTime);
    for (const leadMinutes of [1440, 120]) {
      const scheduledFor = new Date(appointmentAt.getTime() - leadMinutes * 60_000);
      if (scheduledFor > now) continue;
      await ensureNotification({
        type: "appointment_reminder",
        appointmentId: appointment.id,
        clientId: client.id,
        scheduledFor,
        payload: {
          clientName: client.name,
          phone: client.phone,
          service: appointment.serviceId,
          date: appointment.date,
          time: appointment.startTime,
          leadMinutes,
        },
      });
    }
  }
}

async function scheduleBirthdayOutreach(now: Date) {
  const localNow = businessNow();
  const date = localDateKey(localNow);
  const monthDay = date.slice(5);
  const clients = await db.select().from(clientsTable);
  for (const client of clients) {
    if (!client.dateOfBirth || client.dateOfBirth.slice(5) !== monthDay || !client.phone) continue;
    const scheduledFor = localDateTimeUtc(date, 9, 0);
    if (scheduledFor > now) continue;
    await ensureNotification({
      type: "birthday_outreach",
      clientId: client.id,
      scheduledFor,
      payload: { clientName: client.name, phone: client.phone, birthday: date },
    });
  }
}

async function sendWhatsApp(notification: typeof notificationsTable.$inferSelect) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const appointmentTemplate = process.env.WHATSAPP_APPOINTMENT_REMINDER_TEMPLATE;
  const birthdayTemplate = process.env.WHATSAPP_BIRTHDAY_TEMPLATE;
  const language = process.env.WHATSAPP_TEMPLATE_LANGUAGE ?? "en_US";
  if (!token || !phoneNumberId) throw new Error("WhatsApp credentials are not configured");
  const payload = notification.payload as Record<string, any>;
  const templateName = notification.type === "appointment_reminder" ? appointmentTemplate : birthdayTemplate;
  if (!templateName) throw new Error(`WhatsApp template is not configured for ${notification.type}`);

  const parameters = notification.type === "appointment_reminder"
    ? [
        { type: "text", text: String(payload.clientName ?? "") },
        { type: "text", text: String(payload.date ?? "") },
        { type: "text", text: String(payload.time ?? "") },
      ]
    : [{ type: "text", text: String(payload.clientName ?? "") }];

  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: normalizePhone(String(payload.phone ?? "")),
      type: "template",
      template: { name: templateName, language: { code: language }, components: [{ type: "body", parameters }] },
    }),
  });
  const data = await response.json() as { messages?: Array<{ id?: string }>; error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? "WhatsApp provider request failed");
  return data.messages?.[0]?.id ?? null;
}

async function processDueNotifications(now: Date) {
  const due = await db.select().from(notificationsTable).where(and(
    lte(notificationsTable.scheduledFor, now),
    or(eq(notificationsTable.status, "pending"), and(eq(notificationsTable.status, "failed"), lte(notificationsTable.attempts, 2))),
  ));
  let sent = 0;
  let failed = 0;

  for (const notification of due) {
    try {
      const messageId = NOTIFICATION_MODE === "mock" ? `mock_${notification.id}` : await sendWhatsApp(notification);
      await db.update(notificationsTable).set({
        status: "sent",
        providerMessageId: messageId,
        attempts: notification.attempts + 1,
        lastError: null,
        sentAt: new Date(),
      }).where(eq(notificationsTable.id, notification.id));
      sent++;
    } catch (error) {
      await db.update(notificationsTable).set({
        status: "failed",
        attempts: notification.attempts + 1,
        lastError: error instanceof Error ? error.message : "Notification failed",
      }).where(eq(notificationsTable.id, notification.id));
      failed++;
    }
  }
  return { sent, failed, due: due.length };
}

export async function runAutomationCycle() {
  const now = new Date();
  await scheduleAppointmentReminders(now);
  await scheduleBirthdayOutreach(now);
  return processDueNotifications(now);
}

if (process.argv[1]?.endsWith("stage2-automation.ts")) {
  runAutomationCycle().then(result => {
    console.log(JSON.stringify({ stage: 2, automation: result }));
  }).catch(error => {
    console.error(error);
    process.exit(1);
  });
}
