import { pgTable, serial, integer, text, timestamp, numeric, boolean, pgEnum, date, uniqueIndex } from "drizzle-orm/pg-core";

export const accountTypeEnum = pgEnum("account_type", ["asset","liability","equity","revenue","expense"]);
export const journalStatusEnum = pgEnum("journal_status", ["draft","posted","reversed"]);
export const counterpartyTypeEnum = pgEnum("counterparty_type", ["customer","vendor","other"]);
export const accountingPeriodStatusEnum = pgEnum("accounting_period_status", ["open","closed"]);
export const reconciliationStatusEnum = pgEnum("reconciliation_status", ["unreconciled","reconciled"]);

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: accountTypeEnum("type").notNull(),
  parentId: integer("parent_id"),
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountingPeriodsTable = pgTable("accounting_periods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: accountingPeriodStatusEnum("status").notNull().default("open"),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closedBy: integer("closed_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const counterpartiesTable = pgTable("accounting_counterparties", {
  id: serial("id").primaryKey(),
  type: counterpartyTypeEnum("type").notNull(),
  name: text("name").notNull(),
  externalId: text("external_id"),
  clientId: integer("client_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const journalEntriesTable = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  entryDate: date("entry_date").notNull(),
  description: text("description").notNull(),
  referenceType: text("reference_type"),
  referenceId: integer("reference_id"),
  status: journalStatusEnum("status").notNull().default("posted"),
  reversalOfId: integer("reversal_of_id"),
  source: text("source").notNull().default("manual"),
  createdBy: integer("created_by"),
  postedAt: timestamp("posted_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const journalLinesTable = pgTable("journal_lines", {
  id: serial("id").primaryKey(),
  journalEntryId: integer("journal_entry_id").notNull().references(() => journalEntriesTable.id, { onDelete: "cascade" }),
  accountId: integer("account_id").notNull().references(() => accountsTable.id),
  counterpartyId: integer("counterparty_id").references(() => counterpartiesTable.id),
  description: text("description"),
  debit: numeric("debit", { precision: 18, scale: 2 }).notNull().default("0"),
  credit: numeric("credit", { precision: 18, scale: 2 }).notNull().default("0"),
  taxCode: text("tax_code"),
});

export const taxCodesTable = pgTable("tax_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  rate: numeric("rate", { precision: 7, scale: 4 }).notNull(),
  outputAccountId: integer("output_account_id").references(() => accountsTable.id),
  inputAccountId: integer("input_account_id").references(() => accountsTable.id),
  isActive: boolean("is_active").notNull().default(true),
});

export const bankAccountsTable = pgTable("accounting_bank_accounts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  accountId: integer("account_id").notNull().references(() => accountsTable.id),
  currency: text("currency").notNull().default("AED"),
  isActive: boolean("is_active").notNull().default(true),
});

export const bankTransactionsTable = pgTable("bank_transactions", {
  id: serial("id").primaryKey(),
  bankAccountId: integer("bank_account_id").notNull().references(() => bankAccountsTable.id),
  transactionDate: date("transaction_date").notNull(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 18, scale: 2 }).notNull(),
  reference: text("reference"),
  reconciliationStatus: reconciliationStatusEnum("reconciliation_status").notNull().default("unreconciled"),
  matchedJournalLineId: integer("matched_journal_line_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentAllocationsTable = pgTable("payment_allocations", {
  id: serial("id").primaryKey(),
  counterpartyId: integer("counterparty_id").notNull().references(() => counterpartiesTable.id),
  journalLineId: integer("journal_line_id").notNull().references(() => journalLinesTable.id),
  allocatedAmount: numeric("allocated_amount", { precision: 18, scale: 2 }).notNull(),
  allocatedAt: timestamp("allocated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const accountingAuditLogTable = pgTable("accounting_audit_log", {
  id: serial("id").primaryKey(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id"),
  beforeData: text("before_data"),
  afterData: text("after_data"),
  actorId: integer("actor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  entityIdx: uniqueIndex("accounting_audit_entity_idx").on(table.entityType, table.entityId, table.createdAt),
}));

export type Account = typeof accountsTable.$inferSelect;
export type JournalEntry = typeof journalEntriesTable.$inferSelect;
