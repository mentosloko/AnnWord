import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('performance delivery integrity', () => {
  it('keeps hashed bundles immutable while HTML and release metadata revalidate', () => {
    const deploy = read('.github/workflows/yandex-deploy.yml');
    expect(deploy).toContain("--cache-control 'public,max-age=31536000,immutable'");
    expect(deploy).toContain("--cache-control 'public,max-age=0,must-revalidate'");
    expect(deploy).toContain("--cache-control 'no-store'");
    expect(deploy).toContain('Static delivery cache policy: verified');
  });

  it('measures gzip and Brotli before deciding whether extra serving infrastructure is justified', () => {
    const deploy = read('.github/workflows/yandex-deploy.yml');
    const audit = read('scripts/static-compression-audit.mjs');
    expect(deploy).toContain('node scripts/static-compression-audit.mjs');
    expect(audit).toContain('brotliCompressSync');
    expect(audit).toContain('gzipSync');
    expect(audit).toContain('STATIC_COMPRESSION_REPORT');
  });

  it('logs actionable analytics transport failures', () => {
    const analytics = read('services/analyticsService.ts');
    expect(analytics).toContain("const ANALYTICS_ENDPOINT = '/api/analytics/events'");
    expect(analytics).toContain('endpoint: ANALYTICS_ENDPOINT');
    expect(analytics).toContain('durationMs:');
    expect(analytics).toContain('reason: errorReason(error)');
    expect(analytics).toContain('batchSize');
  });

  it('reserves mobile Kids hero space for delayed quest hydration', () => {
    const kids = read('components/screens/KidsHomeScreen.tsx');
    expect(kids).toContain('min-h-[4.5rem] text-3xl');
    expect(kids).toContain('min-h-[4.5rem] max-w-2xl');
    expect(kids).toContain('min-h-[7.5rem] flex-col');
  });
});
