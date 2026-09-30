import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";
import { servicesTable } from "./services";

export const membershipPlansTable = pgTable("membership_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  validityDays: integer("validity_days").notNull().default(365),
  loyaltyPointsBonus: integer("loyalty_points_bonus").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const membershipPlanServicesTable = pgTable("membership_plan_services", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull().references(() => membershipPlansTable.id, { onDelete: "cascade" }),
  serviceId: integer("service_id").notNull().references(() => servicesTable.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull().default(1),
});

export const clientMembershipsTable = pgTable("client_memberships", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  planId: integer("plan_id").notNull().references(() => membershipPlansTable.id, { onDelete: "cascade" }),
  startDate: text("start_date").notNull(),
  expiryDate: text("expiry_date").notNull(),
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull().default("cash"),
  status: text("status").notNull().default("active"),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
});

export const clientMembershipUsageTable = pgTable("client_membership_usage", {
  id: serial("id").primaryKey(),
  clientMembershipId: integer("client_membership_id").notNull().references(() => clientMembershipsTable.id, { onDelete: "cascade" }),
  serviceId: integer("service_id").notNull().references(() => servicesTable.id, { onDelete: "cascade" }),
  usedAt: timestamp("used_at", { withTimezone: true }).notNull().defaultNow(),
  notes: text("notes"),
});

export const insertMembershipPlanSchema = createInsertSchema(membershipPlansTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMembershipPlan = z.infer<typeof insertMembershipPlanSchema>;
export type MembershipPlan = typeof membershipPlansTable.$inferSelect;
export type ClientMembership = typeof clientMembershipsTable.$inferSelect;
