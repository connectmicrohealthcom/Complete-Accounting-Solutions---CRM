import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { clientsTable } from "./clients";

export const giftCardTypesTable = pgTable("gift_card_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  purchaseAmount: numeric("purchase_amount", { precision: 10, scale: 2 }).notNull(),
  creditAmount: numeric("credit_amount", { precision: 10, scale: 2 }).notNull(),
  validityDays: integer("validity_days"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const giftCardsTable = pgTable("gift_cards", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  typeId: integer("type_id").notNull().references(() => giftCardTypesTable.id, { onDelete: "cascade" }),
  referenceCode: text("reference_code").notNull().unique(),
  purchaseAmount: numeric("purchase_amount", { precision: 10, scale: 2 }).notNull(),
  creditAmount: numeric("credit_amount", { precision: 10, scale: 2 }).notNull(),
  remainingBalance: numeric("remaining_balance", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").notNull().default("cash"),
  expiryDate: text("expiry_date"),
  status: text("status").notNull().default("active"),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
});

export const walletTransactionsTable = pgTable("wallet_transactions", {
  id: serial("id").primaryKey(),
  clientId: integer("client_id").notNull().references(() => clientsTable.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  balanceAfter: numeric("balance_after", { precision: 10, scale: 2 }).notNull(),
  description: text("description").notNull(),
  referenceType: text("reference_type"),
  referenceId: integer("reference_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertGiftCardTypeSchema = createInsertSchema(giftCardTypesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertGiftCardType = z.infer<typeof insertGiftCardTypeSchema>;
export type GiftCardType = typeof giftCardTypesTable.$inferSelect;
export type GiftCard = typeof giftCardsTable.$inferSelect;
export type WalletTransaction = typeof walletTransactionsTable.$inferSelect;
