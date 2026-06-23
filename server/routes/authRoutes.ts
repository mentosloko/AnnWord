import { Router } from "express";
import { transaction } from "../db";
import {
  clearSessionCookie,
  createSessionToken,
  findUserByEmail,
  makeSessionPayload,
  makeUserPayload,
  newUserId,
  requireAuth,
  validateNewUserInput,
  verifyPassword,
  writeSessionCookie,
  type AuthenticatedRequest,
  type BackendUser,
} from "../auth";
import { createProfileForUser } from "../profileRepository";

export const authRouter = Router();

const readText = (value: unknown): string => (typeof value === "string" ? value : "");


authRouter.get("/me", requireAuth, (req: AuthenticatedRequest, res) => {
  res.json({ user: req.user ? makeUserPayload(req.user) : null });
});

authRouter.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});
