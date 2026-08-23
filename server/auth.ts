import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { query } from "./db";
import { readRequiredEnv } from "./config";
import { measureServerTiming } from "./performanceTelemetry";

const SESSION_COOKIE_NAME = "annword_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;
const AUTH_USER_CACHE_TTL_MS = Number.parseInt(process.env.AUTH_USER_CACHE_TTL_MS || "60000", 10);

type SessionPayload = {
  sub: string;
  email: string;
  iat: number;
  exp: number;
};

export type BackendUser = {
  id: string;
  email: string;
  name?: string;
  passwordResetRequired: boolean;
};

export type AuthenticatedRequest = Request & {
  user?: BackendUser;
};

type CachedBackendUser = { user: BackendUser; expiresAt: number };
const authUserCache = new Map<string, CachedBackendUser>();
const authUserInflight = new Map<string, Promise<BackendUser | null>>();

const cacheBackendUser = (user: BackendUser): BackendUser => {
  authUserCache.set(user.id, { user, expiresAt: Date.now() + AUTH_USER_CACHE_TTL_MS });
  if (authUserCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of authUserCache) {
      if (value.expiresAt <= now) authUserCache.delete(key);
      if (authUserCache.size <= 750) break;
    }
  }
  return user;
};

function base64urlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function sign(input: string): string {
  return createHmac("sha256", readRequiredEnv("JWT_SECRET")).update(input).digest("base64url");
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error("Введите корректный email.");
  }

  return normalized;
}

function validatePassword(password: string): string {
  if (password.length < 8) {
    throw new Error("Пароль должен быть не короче 8 символов.");
  }

  return password;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const derived = scryptSync(validatePassword(password), salt, 64).toString("base64url");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [scheme, salt, expectedHash] = storedHash.split("$");
  if (scheme !== "scrypt" || !salt || !expectedHash) {
    return false;
  }

  const actualHash = scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, "base64url");

  return expected.length === actualHash.length && timingSafeEqual(expected, actualHash);
}

export function createSessionToken(user: BackendUser): string {
  cacheBackendUser(user);
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub: user.id,
    email: user.email,
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
  };
  const header = base64urlJson({ alg: "HS256", typ: "JWT" });
  const body = base64urlJson(payload);
  const unsigned = `${header}.${body}`;

  return `${unsigned}.${sign(unsigned)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [header, body, signature] = parts;
  const unsigned = `${header}.${body}`;
  const expectedSignature = sign(unsigned);

  const actual = Buffer.from(signature, "base64url");
  const expected = Buffer.from(expectedSignature, "base64url");

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.sub || !payload.email || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function readBearerOrCookieToken(req: Request): string | null {
  const authorization = req.headers.authorization;
  if (typeof authorization === "string" && authorization.toLowerCase().startsWith("bearer ")) {
    return authorization.slice("bearer ".length).trim() || null;
  }

  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader !== "string") {
    return null;
  }

  const cookies = Object.fromEntries(
    cookieHeader.split(";").map((item) => {
      const [key, ...rest] = item.trim().split("=");
      return [key, decodeURIComponent(rest.join("="))];
    }),
  );

  return cookies[SESSION_COOKIE_NAME] || null;
}

export function writeSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

export async function findUserByEmail(email: string): Promise<(BackendUser & { passwordHash: string }) | null> {
  const normalizedEmail = normalizeEmail(email);
  const result = await query<{
    id: string;
    email: string;
    full_name: string | null;
    password_hash: string;
    password_reset_required: boolean;
  }>(
    `select id, email, full_name, password_hash, password_reset_required
       from app_users
      where email = $1`,
    [normalizedEmail],
  );
  const row = result.rows[0];
  if (!row) {
    return null;
  }

  const user = cacheBackendUser({
    id: row.id,
    email: row.email,
    name: row.full_name || undefined,
    passwordResetRequired: row.password_reset_required,
  });
  return { ...user, passwordHash: row.password_hash };
}

async function loadUserById(userId: string): Promise<BackendUser | null> {
  const result = await query<{
    id: string;
    email: string;
    full_name: string | null;
    password_reset_required: boolean;
  }>(
    `select id, email, full_name, password_reset_required
       from app_users
      where id = $1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return cacheBackendUser({
    id: row.id,
    email: row.email,
    name: row.full_name || undefined,
    passwordResetRequired: row.password_reset_required,
  });
}

export async function findUserById(userId: string): Promise<BackendUser | null> {
  const cached = authUserCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.user;
  if (cached) authUserCache.delete(userId);

  const pending = authUserInflight.get(userId);
  if (pending) return pending;

  const request = loadUserById(userId).finally(() => authUserInflight.delete(userId));
  authUserInflight.set(userId, request);
  return request;
}

export function validateNewUserInput(email: string, password: string, name?: string): { email: string; passwordHash: string; name: string } {
  const normalizedEmail = normalizeEmail(email);
  const displayName = name?.trim() || normalizedEmail.split("@")[0] || "Пользователь";

  return {
    email: normalizedEmail,
    passwordHash: hashPassword(password),
    name: displayName.slice(0, 80),
  };
}

export function makeUserPayload(user: BackendUser) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    passwordResetRequired: user.passwordResetRequired,
  };
}

export function makeSessionPayload(user: BackendUser, token: string) {
  return {
    access_token: token,
    token_type: "bearer",
    expires_in: SESSION_TTL_SECONDS,
    user: makeUserPayload(user),
  };
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const token = readBearerOrCookieToken(req);
  const payload = token ? verifySessionToken(token) : null;
  if (!payload) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const user = await measureServerTiming("auth", () => findUserById(payload.sub));
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.user = user;
  next();
}

export function newUserId(): string {
  return randomUUID();
}
