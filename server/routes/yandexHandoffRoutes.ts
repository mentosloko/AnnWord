import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { createSessionToken, makeSessionPayload, writeSessionCookie, type BackendUser } from "../auth";
import { query, transaction } from "../db";
import { appBack, completeYa } from "../ya";

export const yandexHandoffRouter = Router();

const readText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");
const hashCode = (code: string): string => createHash("sha256").update(code).digest("hex");
const newCode = (): string => randomBytes(32).toString("base64url");

async function storeHandoff(user: BackendUser): Promise<string> {
  const code = newCode();
  await query(
    `insert into oauth_handoffs (code_hash, user_id, expires_at)
     values ($1, $2, now() + interval '5 minutes')`,
    [hashCode(code), user.id],
  );
  return code;
}

async function readHandoff(code: string): Promise<BackendUser | null> {
  if (!code || code.length < 20) return null;
  return transaction(async (client) => {
    const result = await client.query<{
      code_hash: string;
      id: string;
      email: string;
      full_name: string | null;
      password_reset_required: boolean;
    }>(
      `select h.code_hash, u.id, u.email, u.full_name, u.password_reset_required
         from oauth_handoffs h
         join app_users u on u.id = h.user_id
        where h.code_hash = $1
          and h.consumed_at is null
          and h.expires_at > now()
        for update of h`,
      [hashCode(code)],
    );
    const row = result.rows[0];
    if (!row) return null;
    await client.query("update oauth_handoffs set consumed_at = now() where code_hash = $1", [row.code_hash]);
    return {
      id: row.id,
      email: row.email,
      name: row.full_name || undefined,
      passwordResetRequired: row.password_reset_required,
    } satisfies BackendUser;
  });
}

yandexHandoffRouter.get("/callback", async (req, res, next) => {
  if (req.path !== "/yandex/callback") return next();
  try {
    const fail = readText(req.query.error);
    if (fail) {
      res.redirect(302, appBack({ auth_error: fail }));
      return;
    }
    const code = readText(req.query.code);
    if (!code) {
      res.redirect(302, appBack({ auth_error: "missing_yandex_code" }));
      return;
    }
    const user = await completeYa(req, code);
    const handoff = await storeHandoff(user);
    console.log("Yandex OAuth handoff created", { userId: user.id });
    res.redirect(302, appBack({ auth: "yandex", oauth_code: handoff }));
  } catch (error) {
    console.error("Yandex OAuth handoff callback failed", error);
    res.redirect(302, appBack({ auth_error: error instanceof Error ? error.message : "yandex_auth_failed" }));
  }
});

yandexHandoffRouter.post("/exchange", async (req, res) => {
  try {
    const user = await readHandoff(readText((req.body || {}).code));
    if (!user) {
      res.status(401).json({ error: "Invalid or expired Yandex login code" });
      return;
    }
    const sessionToken = createSessionToken(user);
    writeSessionCookie(res, sessionToken);
    res.json(makeSessionPayload(user, sessionToken));
  } catch (error) {
    console.error("Yandex OAuth handoff exchange failed", error);
    res.status(400).json({ error: error instanceof Error ? error.message : "Yandex exchange failed" });
  }
});
