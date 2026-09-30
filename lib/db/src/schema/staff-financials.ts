import { pgTable, serial, integer, numeric, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { staffTable } from "./staff";

export const wageTypeEnum = pgEnum("wage_type", ["monthly", "hourly"]);

export const staffWageSettingsTable = pgTable("staff_wage_settings", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().unique().references(() => staffTable.id, { onDelete: "cascade" }),
  wageType: wageTypeEnum("wage_type").notNull().default("monthly"),
  baseAmount: numeric("base_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("AED"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const wagePaymentMethodEnum = pgEnum("wage_payment_method", ["cash", "bank_transfer", "cheque"]);

export const wagePaymentsTable = pgTable("wage_payments", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  periodFrom: text("period_from").notNull(), // YYYY-MM-DD
  periodTo: text("period_to").notNull(), // YYYY-MM-DD
  paymentDate: text("payment_date").notNull(), // YYYY-MM-DD
  paymentMethod: wagePaymentMethodEnum("payment_method").notNull().default("cash"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const commissionSlabsTable = pgTable("commission_slabs", {
  id: serial("id").primaryKey(),
  staffId: integer("staff_id").notNull().references(() => staffTable.id, { onDelete: "cascade" }),
  minAmount: numeric("min_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  maxAmount: numeric("max_amount", { precision: 10, scale: 2 }), // null = unlimited
  rate: numeric("rate", { precision: 5, scale: 2 }).notNull(), // percentage
  sortOrder: integer("sort_order").notNull().default(0),
});

export const insertWageSettingsSchema = createInsertSchema(staffWageSettingsTable).omit({ id: true, updatedAt: true });
export const insertWagePaymentSchema = createInsertSchema(wagePaymentsTable).omit({ id: true, createdAt: true });
export const insertCommissionSlabSchema = createInsertSchema(commissionSlabsTable).omit({ id: true });
export type InsertWageSettings = z.infer<typeof insertWageSettingsSchema>;
export type InsertWagePayment = z.infer<typeof insertWagePaymentSchema>;
export type InsertCommissionSlab = z.infer<typeof insertCommissionSlabSchema>;
export type StaffWageSettings = typeof staffWageSettingsTable.$inferSelect;
export type WagePayment = typeof wagePaymentsTable.$inferSelect;
export type CommissionSlab = typeof commissionSlabsTable.$inferSelect;
