import type { RequestHandler } from "express";

export const requireAuth: RequestHandler = (req, res, next) => {
  const staffId = (req.session as { staffId?: number }).staffId;

  if (!staffId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  next();
};

export const requireRole = (...roles: string[]): RequestHandler => (req, res, next) => {
  const staff = (req.session as { staffId?: number; role?: string }).role;
  if (!staff || !roles.includes(staff)) {
    res.status(403).json({ error: "Insufficient permissions" });
    return;
  }
  next();
};
