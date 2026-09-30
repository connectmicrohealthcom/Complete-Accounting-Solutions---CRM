import type { RequestHandler } from "express";

export const requireAuth: RequestHandler = (req, res, next) => {
  const staffId = (req.session as { staffId?: number }).staffId;

  if (!staffId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  next();
};
