import { pgTable, serial, integer, text, timestamp, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { appointmentsTable } from "./appointments";
import { clientsTable } from "./clients";

export const notificationTypeEnum = pgEnum("notification_type", ["appointment_reminder", "birthday_outreach"]);
export const notificationStatusEnum = pgEnum("notification_status", ["pending", "sent", "failed"]);

export const notificationsTable = pgTable("notifications", {
  id: serial("id").primaryKey(),
  type: notificationTypeEnum("type").notNull(),
  appointmentId: integer("appointment_id").references(() => appointmentsTable.id, { onDelete: "cascade" }),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  scheduledFor: timestamp("scheduled_for", { withTimezone: true }).notNull(),
  status: notificationStatusEnum("status").notNull().default("pending"),
  provider: text("provider").notNull(),
  providerMessageId: text("provider_message_id"),
  payload: jsonb("payload").notNull().default({}),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Notification = typeof notificationsTable.$inferSelect;
