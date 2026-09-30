import { Router, type IRouter } from "express";
import { eq, desc, sql, and } from "drizzle-orm";
import { db, expensesTable, expenseCategoriesTable } from "@workspace/db";

const router: IRouter = Router();

// ─── EXPENSE CATEGORIES ───────────────────────────────────────────────────────

router.get("/expense-categories", async (_req, res): Promise<void> => {
  const cats = await db.select().from(expenseCategoriesTable).orderBy(expenseCategoriesTable.name);
  res.json(cats);
});

router.post("/expense-categories", async (req, res): Promise<void> => {
  const { name } = req.body;
  if (!name) { res.status(400).json({ error: "name required" }); return; }
  const [cat] = await db.insert(expenseCategoriesTable).values({ name }).returning();
  res.status(201).json(cat);
});

router.put("/expense-categories/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name } = req.body;
  const [cat] = await db.update(expenseCategoriesTable).set({ name }).where(eq(expenseCategoriesTable.id, id)).returning();
  if (!cat) { res.status(404).json({ error: "Not found" }); return; }
  res.json(cat);
});

router.delete("/expense-categories/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(expenseCategoriesTable).where(eq(expenseCategoriesTable.id, id));
  res.sendStatus(204);
});

// ─── EXPENSES ─────────────────────────────────────────────────────────────────

router.get("/expenses", async (req, res): Promise<void> => {
  const { from, to, categoryId, paymentMethod } = req.query as Record<string, string>;

  const rows = await db.execute(sql`
    SELECT
      e.*,
      ec.name as category_name
    FROM expenses e
    LEFT JOIN expense_categories ec ON ec.id = e.category_id
    WHERE 1=1
      ${from ? sql`AND e.date >= ${from}` : sql``}
      ${to ? sql`AND e.date <= ${to}` : sql``}
      ${categoryId ? sql`AND e.category_id = ${parseInt(categoryId)}` : sql``}
      ${paymentMethod ? sql`AND e.payment_method = ${paymentMethod}` : sql``}
    ORDER BY e.date DESC, e.created_at DESC
  `);

  const summaryRows = await db.execute(sql`
    SELECT
      ec.name as category_name,
      sum(e.amount) as total,
      count(*) as count
    FROM expenses e
    LEFT JOIN expense_categories ec ON ec.id = e.category_id
    WHERE 1=1
      ${from ? sql`AND e.date >= ${from}` : sql``}
      ${to ? sql`AND e.date <= ${to}` : sql``}
    GROUP BY ec.name
    ORDER BY total DESC
  `);

  const totalAmount = rows.rows.reduce((sum: number, r: any) => sum + Number(r.amount), 0);

  res.json({
    expenses: rows.rows.map((r: any) => ({ ...r, amount: Number(r.amount) })),
    summary: {
      total: totalAmount,
      count: rows.rows.length,
      byCategory: summaryRows.rows.map((r: any) => ({
        category: r.category_name ?? "Uncategorized",
        total: Number(r.total),
        count: Number(r.count),
      })),
    },
  });
});

router.post("/expenses", async (req, res): Promise<void> => {
  const { categoryId, date, amount, description, paymentMethod, receiptRef, addedBy } = req.body;
  if (!date || !amount) { res.status(400).json({ error: "date and amount required" }); return; }
  const [expense] = await db.insert(expensesTable).values({
    categoryId: categoryId ? parseInt(categoryId) : null,
    date, amount: String(amount), description, paymentMethod: paymentMethod ?? "cash",
    receiptRef, addedBy,
  }).returning();
  res.status(201).json({ ...expense, amount: Number(expense.amount) });
});

router.put("/expenses/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { categoryId, date, amount, description, paymentMethod, receiptRef, addedBy } = req.body;
  const [expense] = await db.update(expensesTable).set({
    categoryId: categoryId ? parseInt(categoryId) : null,
    date, amount: String(amount), description, paymentMethod, receiptRef, addedBy,
  }).where(eq(expensesTable.id, id)).returning();
  if (!expense) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...expense, amount: Number(expense.amount) });
});

router.delete("/expenses/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(expensesTable).where(eq(expensesTable.id, id));
  res.sendStatus(204);
});

export default router;
