import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Kids dictionary collection persistence access', () => {
  it('keeps sensitive Kids routes PIN-protected while allowing dictionary collection persistence', () => {
    const parentAccess = readFileSync('server/parentAccess.ts', 'utf8');
    const profileRoutes = readFileSync('server/routes/profileRoutes.ts', 'utf8');

    expect(parentAccess).toContain("req.path === '/dictionary-collections'");
    expect(parentAccess).toContain("req.method === 'GET' || req.method === 'POST'");
    expect(profileRoutes).toMatch(/patch\("\/dictionary", requireParentAccessForKids/);
    expect(profileRoutes).toMatch(/post\("\/dictionary-collections", requireParentAccessForKids/);
  });
});
