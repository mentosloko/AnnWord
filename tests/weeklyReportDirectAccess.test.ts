import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('weekly report default delivery and direct parent access', () => {
  it('defaults parent reports to the account email while preserving an explicit opt-out', () => {
    const repository = read('server/weeklyReportProfileRepository.ts');
    const profile = read('server/profileRepository.ts');
    const family = read('server/routes/familyRoutes.ts');
    const card = read('components/WeeklyReportSettingsCard.tsx');
    const migration = read('db/yandex/20260917_weekly_report_default_email.sql');
    expect(repository).toContain('set weekly_report_email = $2');
    expect(repository).toContain("enabled: profile.weekly_report_email !== ''");
    expect(repository).toContain('profile.weekly_report_email || profile.account_email');
    expect(profile).toContain("when $3 = 'parent' and weekly_report_email is null then (select email from app_users where id = $1)");
    expect(family).toContain('weekly_report_email = coalesce(weekly_report_email, (select email from app_users where id = $1))');
    expect(card).toContain("userProfile.weeklyReportEmail !== ''");
    expect(migration).toContain("SET weekly_report_email = ''");
    expect(migration).toContain('SET weekly_report_email = u.email');
  });

  it('sends default-enabled reports only for configured parent profiles', () => {
    const service = read('server/weeklyReportService.ts');
    expect(service).toContain("p.weekly_report_email is distinct from ''");
    expect(service).toContain('join public.app_users u on u.id = p.id');
    expect(service).toContain("coalesce(nullif(p.weekly_report_email, ''), u.email) as email");
    expect(service).toContain('p.child_display_name is not null');
  });

  it('issues a one-time report token in the URL fragment and exchanges it for parent access', () => {
    const service = read('server/weeklyReportService.ts');
    const route = read('server/routes/magicLinkRoutes.ts');
    const overlay = read('components/auth/MagicLinkOverlay.tsx');
    const familyRoute = read('server/routes/familyRoutes.ts');
    const familyService = read('services/familyAccountService.ts');
    const parent = read('components/screens/ParentDashboardScreen.tsx');
    expect(service).toContain("purpose = 'weekly_report_access'");
    expect(service).toContain('#weekly_report_token=${encodeURIComponent(token)}');
    expect(service).toContain('WEEKLY_REPORT_ACCESS_TTL_DAYS = 8');
    expect(route).toContain("'magic_login', 'weekly_report_access'");
    expect(route).toContain('writeParentAccessCookie(res, user.id)');
    expect(route).toContain("redirectTo: '/workspace?weekly_report=1'");
    expect(overlay).toContain("hashParams.get('weekly_report_token')");
    expect(overlay).toContain('window.location.replace(result.redirectTo)');
    expect(familyRoute).toContain('familyRouter.get("/adult-room", requireParentAccess');
    expect(familyService).toContain('resumeAdultRoom');
    expect(parent).toContain('familyAccountService.resumeAdultRoom()');
  });

  it('uses the protected report URL in both email variants', () => {
    const service = read('server/weeklyReportService.ts');
    expect(service).toContain('reportUrl: string;');
    expect(service).toContain('`Посмотреть прогресс: ${input.reportUrl}`');
    expect(service).toContain('href="${reportUrl}"');
    expect(service).toContain('Открыть отчёт в кабинете');
  });
});
