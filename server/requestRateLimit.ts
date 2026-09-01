import type { NextFunction, Request, Response } from 'express';

type RateLimitOptions = {
  scope: string;
  max: number;
  windowMs: number;
  key?: (req: Request) => string;
};

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let lastSweepAt = 0;

const requestIp = (req: Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return req.ip || req.socket.remoteAddress || 'unknown';
};

const sweepExpiredBuckets = (now: number): void => {
  if (now - lastSweepAt < 60_000) return;
  lastSweepAt = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
};

export const requestText = (value: unknown): string => typeof value === 'string' ? value.trim().toLowerCase() : '';

export const rateLimit = ({ scope, max, windowMs, key }: RateLimitOptions) => (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const now = Date.now();
  sweepExpiredBuckets(now);
  const subject = key ? key(req) : requestIp(req);
  const bucketKey = `${scope}:${subject || 'unknown'}`;
  const current = buckets.get(bucketKey);

  if (!current || current.resetAt <= now) {
    buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    next();
    return;
  }

  current.count += 1;
  if (current.count <= max) {
    next();
    return;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
  res.setHeader('Retry-After', String(retryAfterSeconds));
  res.status(429).json({ code: 'rate_limited', error: 'Слишком много запросов. Попробуйте позже.' });
};
