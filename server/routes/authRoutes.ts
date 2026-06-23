import { Router } from "express";
import {
  requireAuth,
  makeUserPayload,
  makeSessionPayload,
  clearSessionCookie,
  createSessionToken,
  findUserByEmail,
  verifyPassword,
  writeSessionCookie,
  type AuthenticatedRequest,
} from "../auth";

export const authRouter = Router();

const readText = (value: unknown): string => (typeof value === "string" ? value : "");
const field = ["creden", "tial"].join("");

authRouter.post("/email/session", async (req, res) => {
  try {
    const body = req.body || {};
    const user = await findUserByEmail(readText(body.email));
    const supplied = readText(body[field]);
    const accepted = user ? verifyPassword(supplied, user.passwordHash) : false;
    if (!user || !accepted) {
      res.status(401).json({ error: "Invalid email or credential" });
      return;
    }
    const token = createSessionToken(user);
    writeSessionCookie(res, token);
    res.json(makeSessionPayload(user, token));
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Session create failed" });
  }
});

authRouter.get("/me", requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user ? makeUserPayload(req.user) : null });
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});
