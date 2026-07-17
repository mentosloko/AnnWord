import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { defaultWeeklyReportFromEmail, deriveWeeklyReportCronToken, ensureWeeklyReportRuntimeConfig } from '../server/weeklyReportRuntimeConfig';

const read = (path: string): string => readFileSync(path, 'utf8');
const originalJwtSecret = process.env.JWT_SECRET;
const originalCronSecret = process.env.WEEKLY_REPORT_CRON_SECRET;
const originalSender = process.env.WEEKLY_REPORT_FROM_EMAIL;

afterEach(() => {
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalJwtSecret;
  if (originalCronSecret === undefined) delete process.env.WEEKLY_REPORT_CRON_SECRET; else process.env.WEEKLY_REPORT_CRON_SECRET = originalCronSecret;
  if (originalSender === undefined) delete process.env.WEEKLY_REPORT_FROM_EMAIL; else process.env.WEEKLY_REPORT_FROM_EMAIL = originalSender;
});

describe('Yandex post-cutover guarantees', () => {
  it('loads admin analytics through the Yandex API and protects the server snapshot', () => {
    const client = read('services/adminAnalyticsService.ts');
    const routes = read('server/routes/analyticsRoutes.ts');
    expect(client).toContain("backendApiRequest<AdminAnalyticsSnapshot>('/api/analytics/admin')");
    expect(routes).toContain('analyticsRouter.get("/admin", requireAdmin');
    expect(routes).toContain('role !== "admin"');
    expect(routes).toContain('getCustomWordsMissingTranslation');
  });

  it('never trusts analytics user_id supplied by the browser', () => {
    const routes = read('server/routes/analyticsRoutes.ts');
    expect(routes).toContain('const authenticatedUserId = req.user?.id || null');
    expect(routes).toContain('authenticatedUserId,');
    expect(routes).not.toContain('nullableUuid(event.user_id)');
    expect(routes).toContain('analyticsRouter.post("/events", optionalAuth');
  });

  it('keeps both legacy database mutation endpoints disabled without an explicit enable flag', () => {
    const prepare = read('server/routes/migrationSchemaRoutes.ts');
    const migrate = read('server/routes/migrationRoutes.ts');
    expect(prepare).toContain('ANNWORD_ENABLE_SUPABASE_MIGRATION_ENDPOINT === "true"');
    expect(migrate).toContain('ANNWORD_ENABLE_SUPABASE_MIGRATION_ENDPOINT === "true"');
  });

  it('runs Yandex runtime smoke after main deployments and checks the full contour', () => {
    const workflow = read('.github/workflows/yandex-smoke.yml');
    expect(workflow).toContain('- main');
    expect(workflow).not.toContain('- infra/ru-cloud-migration');
    expect(workflow).toContain('/api/health/db');
    expect(workflow).toContain('/api/analytics/admin');
    expect(workflow).toContain('/api/reports/weekly/status');
    expect(workflow).toContain('for PATH_SUFFIX in prepare supabase');
  });

  it('targets Yandex production in Playwright instead of a Vercel preview', () => {
    const workflow = read('.github/workflows/manual-e2e.yml');
    const spec = read('e2e/annword.e2e.spec.ts');
    expect(workflow).toContain("default: 'https://annword.ru'");
    expect(spec).toContain("const DEFAULT_E2E_BASE_URL = 'https://annword.ru'");
    expect(workflow).not.toContain('.vercel.app');
    expect(spec).not.toContain('.vercel.app');
  });

  it('schedules weekly reports against the Yandex API with deterministic internal auth', () => {
    const workflow = read('.github/workflows/yandex-weekly-reports.yml');
    expect(workflow).toContain("cron: '0 7 * * 1'");
    expect(workflow).toContain('/api/reports/weekly/status');
    expect(workflow).toContain('/api/reports/weekly/run');
    expect(workflow).toContain('annword-weekly-reports-v1');
    expect(workflow).not.toContain('vercel');
    expect(workflow).not.toContain('supabase');
  });

  it('derives stable weekly report defaults from Yandex runtime secrets and domain', () => {
    delete process.env.WEEKLY_REPORT_CRON_SECRET;
    delete process.env.WEEKLY_REPORT_FROM_EMAIL;
    process.env.JWT_SECRET = 'audit-secret';
    ensureWeeklyReportRuntimeConfig();
    expect(deriveWeeklyReportCronToken()).toBe(createHmac('sha256', 'audit-secret').update('annword-weekly-reports-v1').digest('hex'));
    expect(process.env.WEEKLY_REPORT_CRON_SECRET).toBe(deriveWeeklyReportCronToken());
    expect(process.env.WEEKLY_REPORT_FROM_EMAIL).toBe(defaultWeeklyReportFromEmail());
    expect(defaultWeeklyReportFromEmail()).toBe('reports@annword.ru');
  });
});
