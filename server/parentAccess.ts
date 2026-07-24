import { createHmac, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AuthenticatedRequest } from './auth';
import { query } from './db';
import { readRequiredEnv } from './config';

const PARENT_ACCESS_COOKIE = 'annword_parent_access';
const PARENT_ACCESS_TTL_SECONDS = 15 * 60;

type ParentAccessPayload = {
  sub: string;
  iat: number;
  exp: number;
};

const encode = (value: unknown): string => Buffer.from(JSON.stringify(value)).toString('base64url');
const signature = (value: string): string => createHmac('sha256', readRequiredEnv('COOKIE_SECRET')).update(value).digest('base64url');
const productionCookie = process.env.NODE_ENV === 'production';
const parentCookieOptions = {
  httpOnly: true,
  sameSite: productionCookie ? 'none' as const : 'lax' as const,
  secure: productionCookie,
  path: '/',
};

const readCookie = (req: Request, name: string): string | null => {
  const header = req.headers.cookie;
  if (typeof header !== 'string') return null;
  const cookies = Object.fromEntries(header.split(';').map(item => {
    const [key, ...rest] = item.trim().split('=');
    return [key, decodeURIComponent(rest.join('='))];
  }));
  return cookies[name] || null;
};

const createParentAccessToken = (userId: string): string => {
  const now = Math.floor(Date.now() / 1000);
  const body = encode({ sub: userId, iat: now, exp: now + PARENT_ACCESS_TTL_SECONDS } satisfies ParentAccessPayload);
  return `${body}.${signature(body)}`;
};

const verifyParentAccessToken = (token: string, userId: string): boolean => {
  const [body, receivedSignature] = token.split('.');
  if (!body || !receivedSignature) return false;
  const actual = Buffer.from(receivedSignature, 'base64url');
  const expected = Buffer.from(signature(body), 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as ParentAccessPayload;
    return payload.sub === userId && payload.exp >= Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
};

export const writeParentAccessCookie = (res: Response, userId: string): void => {
  res.cookie(PARENT_ACCESS_COOKIE, createParentAccessToken(userId), {
    ...parentCookieOptions,
    maxAge: PARENT_ACCESS_TTL_SECONDS * 1000,
  });
};

export const clearParentAccessCookie = (res: Response): void => {
  res.clearCookie(PARENT_ACCESS_COOKIE, parentCookieOptions);
};

export const hasParentAccess = (req: AuthenticatedRequest): boolean => {
  const userId = req.user?.id;
  const token = readCookie(req, PARENT_ACCESS_COOKIE);
  return Boolean(userId && token && verifyParentAccessToken(token, userId));
};

export const requireParentAccess = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (hasParentAccess(req)) {
    next();
    return;
  }
  res.status(403).json({ code: 'parent_access_required', error: 'Введите PIN родителя, чтобы продолжить.' });
};

export const requireParentAccessForKids = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ code: 'unauthorized', error: 'Unauthorized' });
    return;
  }
  const result = await query<{ role: string | null; account_mode: string | null }>('select role, account_mode from profiles where id = $1', [userId]);
  const profile = result.rows[0];
  const kidsMode = profile?.role === 'parent' || profile?.account_mode === 'parent';
  if (!kidsMode || hasParentAccess(req)) {
    next();
    return;
  }
  res.status(403).json({ code: 'parent_access_required', error: 'Введите PIN родителя, чтобы продолжить.' });
};
