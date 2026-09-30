import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, staffTable } from "@workspace/db";
import bcrypt from "bcryptjs";
import { LoginBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const [staff] = await db.select().from(staffTable).where(eq(staffTable.email, email));

  if (!staff || !staff.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, staff.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  (req.session as any).staffId = staff.id;

  const { passwordHash: _ph, ...safeStaff } = staff;
  res.json({
    user: {
      ...safeStaff,
      commissionRate: safeStaff.commissionRate ? Number(safeStaff.commissionRate) : null,
      targetMonthly: safeStaff.targetMonthly ? Number(safeStaff.targetMonthly) : null,
    },
  });
});

router.post("/auth/logout", (req, res): void => {
  (req.session as any).destroy(() => {
    res.json({ ok: true });
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  const staffId = (req.session as any)?.staffId;
  if (!staffId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [staff] = await db.select().from(staffTable).where(eq(staffTable.id, staffId));
  if (!staff) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const { passwordHash: _ph, ...safeStaff } = staff;
  res.json({
    ...safeStaff,
    commissionRate: safeStaff.commissionRate ? Number(safeStaff.commissionRate) : null,
    targetMonthly: safeStaff.targetMonthly ? Number(safeStaff.targetMonthly) : null,
  });
});

export default router;
