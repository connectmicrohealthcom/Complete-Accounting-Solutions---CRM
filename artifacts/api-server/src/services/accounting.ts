import { and, eq, sql } from "drizzle-orm";
import {
  accountsTable, journalEntriesTable, journalLinesTable, salesTable, saleItemsTable,
  expensesTable, taxCodesTable,
} from "@workspace/db";

export const DEFAULT_ACCOUNTS = [
  ["1000","Cash","asset"],["1010","Card Clearing","asset"],["1020","Bank","asset"],["1100","Accounts Receivable","asset"],
  ["1200","Inventory","asset"],["2000","Accounts Payable","liability"],["2100","VAT Output","liability"],["2110","VAT Input","asset"],
  ["2200","Gift Card Liability","liability"],["2300","Client Wallet Liability","liability"],["2400","Customer Advances","liability"],
  ["3000","Owner Equity","equity"],["3100","Retained Earnings","equity"],["4000","Sales Revenue","revenue"],
  ["4100","Other Revenue","revenue"],["5000","Cost of Goods Sold","expense"],["6000","Operating Expense","expense"],
  ["6100","Staff Wages","expense"],["6200","Loyalty Redemption Expense","expense"],
] as const;

export async function ensureDefaultAccounts(tx: any) {
  for (const [code, name, type] of DEFAULT_ACCOUNTS) {
    const existing = await tx.select({ id: accountsTable.id }).from(accountsTable).where(eq(accountsTable.code, code)).limit(1);
    if (!existing[0]) await tx.insert(accountsTable).values({ code, name, type, isSystem: true }).onConflictDoNothing();
  }
  const vat = await tx.select({ id: taxCodesTable.id }).from(taxCodesTable).where(eq(taxCodesTable.code, "VAT5")).limit(1);
  if (!vat[0]) {
    const [output] = await tx.select({ id: accountsTable.id }).from(accountsTable).where(eq(accountsTable.code, "2100")).limit(1);
    const [input] = await tx.select({ id: accountsTable.id }).from(accountsTable).where(eq(accountsTable.code, "2110")).limit(1);
    await tx.insert(taxCodesTable).values({ code: "VAT5", name: "UAE VAT 5%", rate: "5", outputAccountId: output.id, inputAccountId: input.id }).onConflictDoNothing();
  }
}

async function accountId(tx: any, code: string) {
  const [row] = await tx.select({ id: accountsTable.id }).from(accountsTable).where(eq(accountsTable.code, code)).limit(1);
  if (!row) throw new Error(`ACCOUNT_NOT_FOUND:${code}`);
  return row.id;
}

async function isPosted(tx: any, referenceType: string, referenceId: number) {
  const [row] = await tx.select({ id: journalEntriesTable.id }).from(journalEntriesTable)
    .where(and(eq(journalEntriesTable.referenceType, referenceType), eq(journalEntriesTable.referenceId, referenceId), eq(journalEntriesTable.status, "posted"))).limit(1);
  return row?.id ?? null;
}

export async function postSaleTx(tx: any, saleId: number, actorId?: number | null) {
  await ensureDefaultAccounts(tx);
  const existing = await isPosted(tx, "sale", saleId);
  if (existing) return existing;
  const [sale] = await tx.select().from(salesTable).where(eq(salesTable.id, saleId));
  if (!sale) throw new Error("SALE_NOT_FOUND");
  const [items] = await Promise.all([tx.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, saleId))]);
  const debitCode = sale.paymentMethod === "cash" ? "1000"
    : sale.paymentMethod === "bank_transfer" ? "1020"
    : sale.paymentMethod === "wallet" ? "2300"
    : sale.paymentMethod === "loyalty_points" ? "6200"
    : "1010";
  const debit = await accountId(tx, debitCode);
  const revenue = await accountId(tx, "4000");
  const [entry] = await tx.insert(journalEntriesTable).values({
    entryDate: sale.createdAt.toISOString().slice(0,10),
    description: `Sale #${sale.id}`,
    referenceType: "sale", referenceId: sale.id, source: "sale", createdBy: actorId ?? null,
  }).returning();
  await tx.insert(journalLinesTable).values([
    { journalEntryId: entry.id, accountId: debit, description: `Sale #${sale.id} receipt`, debit: String(sale.total), credit: "0" },
    { journalEntryId: entry.id, accountId: revenue, description: `Sale #${sale.id} revenue`, debit: "0", credit: String(sale.total) },
  ]);
  return entry.id;
}

export async function postExpenseTx(tx: any, expenseId: number, actorId?: number | null) {
  await ensureDefaultAccounts(tx);
  const existing = await isPosted(tx, "expense", expenseId);
  if (existing) return existing;
  const [expense] = await tx.select().from(expensesTable).where(eq(expensesTable.id, expenseId));
  if (!expense) throw new Error("EXPENSE_NOT_FOUND");
  const debit = await accountId(tx, "6000");
  const credit = expense.paymentMethod === "bank_transfer" ? await accountId(tx, "1020") : await accountId(tx, "1000");
  const [entry] = await tx.insert(journalEntriesTable).values({
    entryDate: expense.date,
    description: expense.description ?? `Expense #${expense.id}`,
    referenceType: "expense", referenceId: expense.id, source: "expense", createdBy: actorId ?? null,
  }).returning();
  await tx.insert(journalLinesTable).values([
    { journalEntryId: entry.id, accountId: debit, description: `Expense #${expense.id}`, debit: String(expense.amount), credit: "0" },
    { journalEntryId: entry.id, accountId: credit, description: `Expense #${expense.id} payment`, debit: "0", credit: String(expense.amount) },
  ]);
  return entry.id;
}
