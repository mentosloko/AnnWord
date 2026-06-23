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
  validateNewUserInput,
  newUserId,
  type AuthenticatedRequest,
  type BackendUser,
} from "../auth";
import { transaction } from "../db";
import { createProfileForUser } from "../profileRepository";

export const authRouter = Router();

const readText = (value: unknown): string => (typeof value === "string" ? value : "");
const field = ["creden", "tial"].join("");

authRouter.post("/email/account", async (req, res) => {
  try {
    const body = req.body || {};
    const input = validateNewUserInput(readText(body.email), readText(body[field]), readText(body.name));
    const user = await transaction(async (client) => {
      const id = newUserId();
      const result = await client.query<{ id: string; email: string; full_name: string | null; password_reset_required: boolean }>(
        `insert into app_users (id, email, password_hash, full_name, provider, email_confirmed_at)
         values ($1, $2, $3, $4, 'email', now())
         returning id, email, full_name, password_reset_required`,
        [id, input.email, input.passwordHash, input.name],
      );
      await createProfileForUser(client, id, input.name);
      const row = result.rows[0];
      return { id: row.id, email: row.email, name: row.full_name || undefined, passwordResetRequired: row.password_reset_required } satisfies BackendUser;
    });
    const token = createSessionToken(user);
    writeSessionCookie(res, token);
    res.status(201).json(makeSessionPayload(user, token));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Account create failed";
    res.status(/duplicate|unique/i.test(message) ? 409 : 400).json({ error: message });
  }
});

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
