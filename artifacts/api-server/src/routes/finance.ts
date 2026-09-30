import { Router, type IRouter } from "express";
import { eq, sql, gte, lte, and, desc, inArray } from "drizzle-orm";
import {
  db, salesTable, saleItemsTable, clientsTable, staffTable,
  serviceCategoriesTable, servicesTable, expensesTable, expenseCategoriesTable,
} from "@workspace/db";

const router: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dateFilter(table: any, field: string, from?: string, to?: string) {
  const filters: any[] = [];
  if (from) filters.push(sql`${table[field]} >= ${from}::date`);
  if (to)   filters.push(sql`${table[field]} <= ${to}::date`);
  return filters;
}

// ─── PAYMENT SUMMARY ─────────────────────────────────────────────────────────

// GET /finance/sales-log
router.get("/finance/sales-log", async (req, res): Promise<void> => {
  const { from, to, paymentMethod, clientId, staffId, page = "1", limit = "50" } = req.query as Record<string, string>;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const rows = await db.execute(sql`
    SELECT
      s.id,
      s.created_at,
      COALESCE(c.name, 'Walk-in') as client_name,
      c.phone as client_phone,
      st.name as staff_name,
      s.subtotal,
      s.discount,
      s.total,
      s.payment_method,
      s.notes,
      (
        SELECT json_agg(json_build_object(
          'name', si.name,
          'type', si.type,
          'quantity', si.quantity,
          'unit_price', si.unit_price,
          'total_price', si.total_price
        ))
        FROM sale_items si WHERE si.sale_id = s.id
      ) as items
    FROM sales s
    LEFT JOIN clients c ON c.id = s.client_id
    LEFT JOIN staff st ON st.id = s.staff_id
    WHERE 1=1
      ${from ? sql`AND s.created_at >= ${from}::date` : sql``}
      ${to ? sql`AND s.created_at < (${to}::date + interval '1 day')` : sql``}
      ${paymentMethod ? sql`AND s.payment_method = ${paymentMethod}` : sql``}
      ${clientId ? sql`AND s.client_id = ${parseInt(clientId)}` : sql``}
      ${staffId ? sql`AND s.staff_id = ${parseInt(staffId)}` : sql``}
    ORDER BY s.created_at DESC
    LIMIT ${parseInt(limit)} OFFSET ${offset}
  `);

  const countResult = await db.execute(sql`
    SELECT count(*) as total FROM sales s
    WHERE 1=1
      ${from ? sql`AND s.created_at >= ${from}::date` : sql``}
      ${to ? sql`AND s.created_at < (${to}::date + interval '1 day')` : sql``}
      ${paymentMethod ? sql`AND s.payment_method = ${paymentMethod}` : sql``}
      ${clientId ? sql`AND s.client_id = ${parseInt(clientId)}` : sql``}
      ${staffId ? sql`AND s.staff_id = ${parseInt(staffId)}` : sql``}
  `);

  res.json({
    sales: rows.rows.map((r: any) => ({
      ...r,
      subtotal: Number(r.subtotal),
      discount: Number(r.discount),
      total: Number(r.total),
    })),
    total: Number((countResult.rows[0] as any)?.total ?? 0),
    page: parseInt(page),
    limit: parseInt(limit),
  });
});

// GET /finance/payment-breakdown
router.get("/finance/payment-breakdown", async (req, res): Promise<void> => {
  const { from, to } = req.query as Record<string, string>;
  const rows = await db.execute(sql`
    SELECT
      payment_method,
      count(*) as transaction_count,
      sum(total) as total_amount,
      avg(total) as avg_amount
    FROM sales
    WHERE 1=1
      ${from ? sql`AND created_at >= ${from}::date` : sql``}
      ${to ? sql`AND created_at < (${to}::date + interval '1 day')` : sql``}
    GROUP BY payment_method
    ORDER BY total_amount DESC
  `);
  res.json(rows.rows.map((r: any) => ({
    paymentMethod: r.payment_method,
    transactionCount: Number(r.transaction_count),
    totalAmount: Number(r.total_amount),
    avgAmount: Number(r.avg_amount),
  })));
});

// GET /finance/client-payments/:clientId
router.get("/finance/client-payments/:clientId", async (req, res): Promise<void> => {
  const clientId = parseInt(req.params.clientId);
  const rows = await db.execute(sql`
    SELECT
      s.id,
      s.created_at,
      st.name as staff_name,
      s.subtotal,
      s.discount,
      s.total,
      s.payment_method,
      s.notes,
      (SELECT json_agg(json_build_object('name', si.name, 'total_price', si.total_price))
       FROM sale_items si WHERE si.sale_id = s.id) as items
    FROM sales s
    LEFT JOIN staff st ON st.id = s.staff_id
    WHERE s.client_id = ${clientId}
    ORDER BY s.created_at DESC
  `);
  res.json(rows.rows.map((r: any) => ({
    ...r,
    subtotal: Number(r.subtotal),
    discount: Number(r.discount),
    total: Number(r.total),
  })));
});

// ─── FINANCIAL REPORTS ───────────────────────────────────────────────────────

// GET /finance/reports/pnl
router.get("/finance/reports/pnl", async (req, res): Promise<void> => {
  const { from, to } = req.query as Record<string, string>;

  const [revenueRows, expenseRows, categoryRevenueRows] = await Promise.all([
    db.execute(sql`
      SELECT sum(total) as total_revenue, count(*) as sale_count
      FROM sales
      WHERE 1=1
        ${from ? sql`AND created_at >= ${from}::date` : sql``}
        ${to ? sql`AND created_at < (${to}::date + interval '1 day')` : sql``}
    `),
    db.execute(sql`
      SELECT
        ec.name as category_name,
        sum(e.amount) as total
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.category_id
      WHERE 1=1
        ${from ? sql`AND e.date >= ${from}` : sql``}
        ${to ? sql`AND e.date <= ${to}` : sql``}
      GROUP BY ec.name
      ORDER BY total DESC
    `),
    db.execute(sql`
      SELECT
        sc.name as category_name,
        sum(si.total_price) as revenue
      FROM sale_items si
      JOIN services sv ON sv.id = si.reference_id AND si.type = 'service'
      JOIN service_categories sc ON sc.id = sv.category_id
      JOIN sales s ON s.id = si.sale_id
      WHERE 1=1
        ${from ? sql`AND s.created_at >= ${from}::date` : sql``}
        ${to ? sql`AND s.created_at < (${to}::date + interval '1 day')` : sql``}
      GROUP BY sc.name
      ORDER BY revenue DESC
    `),
  ]);

  const totalRevenue = Number((revenueRows.rows[0] as any)?.total_revenue ?? 0);
  const totalExpenses = expenseRows.rows.reduce((sum: number, r: any) => sum + Number(r.total), 0);
  const grossProfit = totalRevenue;
  const netProfit = grossProfit - totalExpenses;

  res.json({
    period: { from, to },
    revenue: {
      total: totalRevenue,
      saleCount: Number((revenueRows.rows[0] as any)?.sale_count ?? 0),
      byCategory: categoryRevenueRows.rows.map((r: any) => ({
        category: r.category_name ?? "Uncategorized",
        revenue: Number(r.revenue),
      })),
    },
    expenses: {
      total: totalExpenses,
      byCategory: expenseRows.rows.map((r: any) => ({
        category: r.category_name ?? "Uncategorized",
        total: Number(r.total),
      })),
    },
    grossProfit,
    netProfit,
  });
});

// GET /finance/reports/trial-balance
router.get("/finance/reports/trial-balance", async (req, res): Promise<void> => {
  const { from, to } = req.query as Record<string, string>;

  const [salesRows, expenseRows] = await Promise.all([
    db.execute(sql`
      SELECT
        'Sales Revenue' as description,
        payment_method,
        sum(total) as amount,
        created_at::date as entry_date
      FROM sales
      WHERE 1=1
        ${from ? sql`AND created_at >= ${from}::date` : sql``}
        ${to ? sql`AND created_at < (${to}::date + interval '1 day')` : sql``}
      GROUP BY payment_method, created_at::date
      ORDER BY entry_date
    `),
    db.execute(sql`
      SELECT
        COALESCE(ec.name, 'Misc') as description,
        e.payment_method,
        e.amount,
        e.date as entry_date
      FROM expenses e
      LEFT JOIN expense_categories ec ON ec.id = e.category_id
      WHERE 1=1
        ${from ? sql`AND e.date >= ${from}` : sql``}
        ${to ? sql`AND e.date <= ${to}` : sql``}
      ORDER BY e.date
    `),
  ]);

  const income = salesRows.rows.map((r: any) => ({
    date: r.entry_date,
    description: `Sales Revenue (${r.payment_method})`,
    debit: 0,
    credit: Number(r.amount),
  }));

  const expenses = expenseRows.rows.map((r: any) => ({
    date: r.entry_date,
    description: r.description,
    debit: Number(r.amount),
    credit: 0,
  }));

  const entries = [...income, ...expenses].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const totalCredit = entries.reduce((sum, e) => sum + e.credit, 0);
  const totalDebit  = entries.reduce((sum, e) => sum + e.debit, 0);

  res.json({ entries, totalCredit, totalDebit, netBalance: totalCredit - totalDebit });
});

// GET /finance/reports/balance-sheet
router.get("/finance/reports/balance-sheet", async (req, res): Promise<void> => {
  const { to } = req.query as Record<string, string>;

  const [cashRows, walletRows, giftCardRows, totalExpenses] = await Promise.all([
    db.execute(sql`
      SELECT sum(total) as cash_sales FROM sales
      WHERE payment_method = 'cash'
      ${to ? sql`AND created_at < (${to}::date + interval '1 day')` : sql``}
    `),
    db.execute(sql`SELECT sum(wallet_balance) as total FROM clients WHERE wallet_balance > 0`),
    db.execute(sql`SELECT sum(remaining_balance) as total FROM gift_cards WHERE remaining_balance > 0`),
    db.execute(sql`
      SELECT sum(amount) as total FROM expenses
      ${to ? sql`WHERE date <= ${to}` : sql``}
    `),
  ]);

  const cashOnHand = Number((cashRows.rows[0] as any)?.cash_sales ?? 0);
  const walletLiability = Number((walletRows.rows[0] as any)?.total ?? 0);
  const giftCardLiability = Number((giftCardRows.rows[0] as any)?.total ?? 0);
  const totalExp = Number((totalExpenses.rows[0] as any)?.total ?? 0);

  const [totalRevRows] = await Promise.all([
    db.execute(sql`
      SELECT sum(total) as total FROM sales
      ${to ? sql`WHERE created_at < (${to}::date + interval '1 day')` : sql``}
    `),
  ]);
  const totalRevenue = Number((totalRevRows.rows[0] as any)?.total ?? 0);
  const netProfit = totalRevenue - totalExp;

  res.json({
    asOf: to ?? new Date().toISOString().split("T")[0],
    assets: {
      cashOnHand,
      walletReceivables: walletLiability,
      totalAssets: cashOnHand + walletLiability,
    },
    liabilities: {
      giftCardOutstanding: giftCardLiability,
      totalLiabilities: giftCardLiability,
    },
    equity: {
      netProfit,
      totalEquity: netProfit,
    },
  });
});

export default router;
