import { Router, type IRouter } from "express";
import { eq, sql, lte, gte, lt, gt, and, or, desc, inArray } from "drizzle-orm";
import {
  db, clientsTable, appointmentsTable, salesTable, saleItemsTable,
  clientGroupsTable, servicesTable, serviceCategoriesTable,
} from "@workspace/db";
import type { GroupRule } from "@workspace/db";

const router: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function formatClient(c: typeof clientsTable.$inferSelect) {
  return {
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email,
    lastVisit: c.lastVisit ? c.lastVisit.toISOString() : null,
    totalSpent: Number(c.totalSpent),
    visitCount: c.visitCount,
    dateOfBirth: c.dateOfBirth,
    tags: c.tags,
  };
}

// ─── AUTO GROUPS ─────────────────────────────────────────────────────────────

const AUTO_GROUPS = [
  { id: "no-sale-30",      label: "No Sale (30 Days)",         description: "No completed appointment in the last 30 days" },
  { id: "no-sale-60",      label: "No Sale (60 Days)",         description: "No completed appointment in the last 60 days" },
  { id: "no-sale-90",      label: "No Sale (90 Days)",         description: "No completed appointment in the last 90 days" },
  { id: "new-this-month",  label: "New Clients (This Month)",  description: "First appointment in the current calendar month" },
  { id: "recent-7",        label: "Recent (Last 7 Days)",      description: "Completed appointment in the last 7 days" },
  { id: "vip",             label: "VIP Clients",               description: "Lifetime spend exceeds AED 5,000" },
  { id: "high-spenders",   label: "High Spenders (Weekly AED 200+)", description: "Average spend per week AED 200 or more" },
  { id: "hair-clients",    label: "Hair Service Clients",      description: "Has had at least one hair treatment service" },
  { id: "nail-clients",    label: "Nail Service Clients",      description: "Has had at least one nail service" },
  { id: "members",         label: "Membership Clients",        description: "Holds an active membership plan" },
  { id: "gift-card",       label: "Gift Card Clients",         description: "Purchased or holds an active gift card balance" },
  { id: "birthday-month",  label: "Birthday This Month",       description: "Birthday falls in the current calendar month" },
];

async function getAutoGroupMembers(groupId: string): Promise<typeof clientsTable.$inferSelect[]> {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  switch (groupId) {
    case "no-sale-30":
    case "no-sale-60":
    case "no-sale-90": {
      const days = groupId === "no-sale-30" ? 30 : groupId === "no-sale-60" ? 60 : 90;
      const cutoff = daysAgo(days);
      return await db.select().from(clientsTable)
        .where(or(
          sql`${clientsTable.lastVisit} IS NULL`,
          lt(clientsTable.lastVisit, cutoff)
        ))
        .orderBy(desc(clientsTable.totalSpent));
    }
    case "new-this-month": {
      const som = startOfMonth();
      return await db.select().from(clientsTable)
        .where(gte(clientsTable.createdAt, som))
        .orderBy(desc(clientsTable.createdAt));
    }
    case "recent-7": {
      const cutoff = daysAgo(7);
      return await db.select().from(clientsTable)
        .where(and(
          sql`${clientsTable.lastVisit} IS NOT NULL`,
          gte(clientsTable.lastVisit, cutoff)
        ))
        .orderBy(desc(clientsTable.lastVisit));
    }
    case "vip": {
      return await db.select().from(clientsTable)
        .where(gte(clientsTable.totalSpent, "5000"))
        .orderBy(desc(clientsTable.totalSpent));
    }
    case "high-spenders": {
      const allClients = await db.select().from(clientsTable);
      return allClients.filter((c) => {
        if (!c.createdAt || Number(c.totalSpent) === 0) return false;
        const weeksSince = Math.max(1, Math.floor((now.getTime() - new Date(c.createdAt).getTime()) / (7 * 24 * 60 * 60 * 1000)));
        return Number(c.totalSpent) / weeksSince >= 200;
      }).sort((a, b) => Number(b.totalSpent) - Number(a.totalSpent));
    }
    case "hair-clients":
    case "nail-clients": {
      const keyword = groupId === "hair-clients" ? "hair" : "nail";
      const cats = await db.select().from(serviceCategoriesTable)
        .where(sql`lower(${serviceCategoriesTable.name}) like ${'%' + keyword + '%'}`);
      if (!cats.length) return [];
      const catIds = cats.map((c) => c.id);
      const svcs = await db.select().from(servicesTable).where(inArray(servicesTable.categoryId, catIds));
      if (!svcs.length) return [];
      const svcIds = svcs.map((s) => s.id);
      const appts = await db.selectDistinct({ clientId: appointmentsTable.clientId })
        .from(appointmentsTable)
        .where(and(
          inArray(appointmentsTable.serviceId, svcIds),
          eq(appointmentsTable.status, "completed")
        ));
      const clientIds = appts.map((a) => a.clientId);
      if (!clientIds.length) return [];
      return await db.select().from(clientsTable)
        .where(inArray(clientsTable.id, clientIds))
        .orderBy(desc(clientsTable.totalSpent));
    }
    case "members": {
      const rows = await db.execute(
        sql`SELECT DISTINCT c.* FROM clients c
            JOIN client_memberships cm ON cm.client_id = c.id
            WHERE cm.status = 'active'
            ORDER BY c.total_spent DESC`
      );
      return rows.rows as any[];
    }
    case "gift-card": {
      const rows = await db.execute(
        sql`SELECT DISTINCT c.* FROM clients c
            JOIN gift_cards gc ON gc.client_id = c.id
            WHERE gc.balance > 0
            ORDER BY c.total_spent DESC`
      );
      return rows.rows as any[];
    }
    case "birthday-month": {
      return await db.select().from(clientsTable)
        .where(sql`EXTRACT(MONTH FROM TO_DATE(${clientsTable.dateOfBirth}, 'YYYY-MM-DD')) = ${currentMonth}`)
        .orderBy(clientsTable.name);
    }
    default:
      return [];
  }
}

// ─── GET /clients/groups/auto ─────────────────────────────────────────────────
router.get("/clients/groups/auto", async (_req, res): Promise<void> => {
  const groups = await Promise.all(
    AUTO_GROUPS.map(async (g) => {
      try {
        const members = await getAutoGroupMembers(g.id);
        return { ...g, count: members.length, type: "auto" };
      } catch {
        return { ...g, count: 0, type: "auto" };
      }
    })
  );
  res.json(groups);
});

// ─── GET /clients/groups/auto/:id/members ────────────────────────────────────
router.get("/clients/groups/auto/:id/members", async (req, res): Promise<void> => {
  const groupId = req.params.id;
  const members = await getAutoGroupMembers(groupId);
  res.json(members.map(formatClient));
});

// ─── Custom groups CRUD ───────────────────────────────────────────────────────

router.get("/clients/groups/custom", async (_req, res): Promise<void> => {
  const groups = await db.select().from(clientGroupsTable).orderBy(desc(clientGroupsTable.createdAt));
  res.json(groups);
});

router.post("/clients/groups/custom", async (req, res): Promise<void> => {
  const { name, logic, rules } = req.body;
  if (!name || !rules) { res.status(400).json({ error: "name and rules required" }); return; }
  const [group] = await db.insert(clientGroupsTable).values({ name, logic: logic ?? "AND", rules }).returning();
  res.status(201).json(group);
});

router.put("/clients/groups/custom/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { name, logic, rules } = req.body;
  const [group] = await db.update(clientGroupsTable).set({ name, logic, rules }).where(eq(clientGroupsTable.id, id)).returning();
  if (!group) { res.status(404).json({ error: "Not found" }); return; }
  res.json(group);
});

router.delete("/clients/groups/custom/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(clientGroupsTable).where(eq(clientGroupsTable.id, id));
  res.sendStatus(204);
});

// ─── Evaluate custom group members ───────────────────────────────────────────

async function evaluateCustomGroup(rules: GroupRule[], logic: string): Promise<typeof clientsTable.$inferSelect[]> {
  const allClients = await db.select().from(clientsTable).orderBy(desc(clientsTable.totalSpent));
  const now = new Date();

  const passes = (client: typeof clientsTable.$inferSelect, rule: GroupRule): boolean => {
    const { field, operator, value } = rule;
    const numVal = Number(value);
    switch (field) {
      case "last_visit_days": {
        if (!client.lastVisit) return operator === "gt";
        const daysSince = Math.floor((now.getTime() - new Date(client.lastVisit).getTime()) / 86400000);
        return operator === "gt" ? daysSince > numVal : daysSince < numVal;
      }
      case "total_spend":
        return operator === "gt" ? Number(client.totalSpent) > numVal : Number(client.totalSpent) < numVal;
      case "avg_spend_per_visit": {
        const avg = client.visitCount > 0 ? Number(client.totalSpent) / client.visitCount : 0;
        return operator === "gt" ? avg > numVal : avg < numVal;
      }
      case "visit_count":
        return operator === "gt" ? client.visitCount > numVal : client.visitCount < numVal;
      case "client_since": {
        const clientDate = new Date(client.createdAt);
        const targetDate = new Date(String(value));
        return operator === "before" ? clientDate < targetDate : clientDate > targetDate;
      }
      case "has_membership":
        return String(value) === "yes";
      case "has_wallet":
        return operator === "yes" ? Number(client.walletBalance) > 0 : Number(client.walletBalance) === 0;
      case "birthday_month": {
        if (!client.dateOfBirth) return false;
        const bMonth = new Date(client.dateOfBirth).getMonth() + 1;
        return bMonth === numVal;
      }
      default:
        return true;
    }
  };

  return allClients.filter((client) => {
    if (!rules || rules.length === 0) return true;
    if (logic === "OR") return rules.some((r) => passes(client, r));
    return rules.every((r) => passes(client, r));
  });
}

router.get("/clients/groups/custom/:id/members", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [group] = await db.select().from(clientGroupsTable).where(eq(clientGroupsTable.id, id));
  if (!group) { res.status(404).json({ error: "Not found" }); return; }
  const members = await evaluateCustomGroup(group.rules as GroupRule[], group.logic);
  res.json(members.map(formatClient));
});

// Count members for list view
router.get("/clients/groups/custom/:id/count", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [group] = await db.select().from(clientGroupsTable).where(eq(clientGroupsTable.id, id));
  if (!group) { res.status(404).json({ error: "Not found" }); return; }
  const members = await evaluateCustomGroup(group.rules as GroupRule[], group.logic);
  res.json({ count: members.length });
});

export default router;
