import { pgTable, text, serial, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const clientGroupsTable = pgTable("client_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  logic: text("logic").notNull().default("AND"),
  rules: jsonb("rules").notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertClientGroupSchema = createInsertSchema(clientGroupsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertClientGroup = z.infer<typeof insertClientGroupSchema>;
export type ClientGroup = typeof clientGroupsTable.$inferSelect;

export type GroupRule = {
  field: string;
  operator: string;
  value: string | number;
};
