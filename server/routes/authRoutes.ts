import { Router } from "express";
import { requireAuth, makeUserPayload, clearSessionCookie, type AuthenticatedRequest } from "../auth";

export const authRouter = Router();

authRouter.get("/me", requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user ? makeUserPayload(req.user) : null });
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});
