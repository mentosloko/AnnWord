import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('security API hardening', () => {
  it('applies bounded rate limits to authentication and mutable game routes', () => {
    const api = read('server/yandex-api.ts');
    const limiter = read('server/requestRateLimit.ts');
    expect(limiter).toContain("res.status(429)");
    expect(api).toContain('authRegistrationLimit');
    expect(api).toContain('authLoginLimit');
    expect(api).toContain('authRecoveryLimit');
    expect(api).toContain('oauthExchangeLimit');
    expect(api).toContain('gameMutationLimit');
    expect(api).toContain('req.path.startsWith("/api/profile/")');
    expect(api).toContain('"/api/game-events/events"');
    expect(api).toContain('"/api/daily-quest/result"');
  });

  it('fails closed for production CORS and does not retain Vercel wildcard access', () => {
    const api = read('server/yandex-api.ts');
    expect(api).toContain('allowedOrigins.has(normalizedOrigin)');
    expect(api).toContain('runtimeConfig.env !== "production"');
    expect(api).not.toContain('isAnnWordVercel');
    expect(api).not.toContain('for (const protocol of ["https:", "http:"])');
  });

  it('keeps health probes usable without revealing runtime configuration or database timings', () => {
    const api = read('server/yandex-api.ts');
    expect(api).toContain('database: { ok: database.ok }');
    expect(api).toContain('res.json({ status: "ok", service: "annword-api" });');
    expect(api).not.toContain('hasYandexOAuth');
    expect(api).not.toContain('hasObjectStorage');
    expect(api).not.toContain('latencyMs');
  });
});
