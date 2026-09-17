from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{path}: expected one occurrence, found {count}: {old[:160]!r}')
    p.write_text(text.replace(old, new, 1))


# Default weekly reports to the account email; empty string remains an explicit opt-out.
replace_once(
    'server/weeklyReportProfileRepository.ts',
    "set weekly_report_email = nullif($2, ''),",
    "set weekly_report_email = $2,",
)
replace_once(
    'server/weeklyReportProfileRepository.ts',
    "    enabled: Boolean(profile.weekly_report_email?.trim()),\n    email: profile.weekly_report_email || null,",
    "    enabled: profile.weekly_report_email !== '',\n    email: profile.weekly_report_email === '' ? null : (profile.weekly_report_email || profile.account_email),",
)

card = Path('components/WeeklyReportSettingsCard.tsx')
card_text = card.read_text()
old_enabled = 'Boolean(userProfile.weeklyReportEmail)'
if card_text.count(old_enabled) != 2:
    raise SystemExit(f'WeeklyReportSettingsCard: expected two legacy enabled checks, found {card_text.count(old_enabled)}')
card.write_text(card_text.replace(old_enabled, "userProfile.weeklyReportEmail !== ''"))

replace_once(
    'server/profileRepository.ts',
    "        set role = $2,\n            account_mode = $3,\n            feature_flags = case",
    "        set role = $2,\n            account_mode = $3,\n            weekly_report_email = case\n              when $3 = 'parent' and weekly_report_email is null then (select email from app_users where id = $1)\n              else weekly_report_email\n            end,\n            feature_flags = case",
)

replace_once(
    'server/routes/familyRoutes.ts',
    "child_slots_limit = 1, access_digest = $3, role = 'parent', account_mode = 'parent', feature_flags =",
    "child_slots_limit = 1, access_digest = $3, role = 'parent', account_mode = 'parent', weekly_report_email = coalesce(weekly_report_email, (select email from app_users where id = $1)), feature_flags =",
)

# Secure one-time weekly-report link issued only when an email is actually prepared.
replace_once(
    'server/weeklyReportService.ts',
    "import { query } from './db';",
    "import { createHash, randomBytes } from 'node:crypto';\nimport { query } from './db';",
)
replace_once(
    'server/weeklyReportService.ts',
    "import { loadMasterDictionaryTranslations } from '../services/masterDictionaryLookup';",
    "import { loadMasterDictionaryTranslations } from '../services/masterDictionaryLookup';\nimport { ensureAccountActionTokenSchema } from './accountActionTokenSchema';",
)
replace_once(
    'server/weeklyReportService.ts',
    "export interface WeeklyReportContentInput {\n  learnerName: string;",
    "export interface WeeklyReportContentInput {\n  learnerName: string;\n  reportUrl: string;",
)
replace_once(
    'server/weeklyReportService.ts',
    "let tokenCache: { token: string; expiresAt: number } | null = null;",
    """let tokenCache: { token: string; expiresAt: number } | null = null;
const WEEKLY_REPORT_ACCESS_TTL_DAYS = 8;
const hashActionToken = (token: string): string => createHash('sha256').update(token).digest('hex');

const issueWeeklyReportAccessUrl = async (userId: string): Promise<string> => {
  await ensureAccountActionTokenSchema();
  await query(
    \"update public.account_action_tokens set used_at = now() where user_id = $1 and purpose = 'weekly_report_access' and used_at is null\",
    [userId],
  );
  const token = randomBytes(32).toString('base64url');
  await query(
    `insert into public.account_action_tokens (user_id, token_hash, purpose, expires_at)
     values ($1, $2, 'weekly_report_access', now() + interval '${WEEKLY_REPORT_ACCESS_TTL_DAYS} days')`,
    [userId, hashActionToken(token)],
  );
  await query(\"delete from public.account_action_tokens where expires_at < now() - interval '1 day' or used_at < now() - interval '1 day'\");
  const appUrl = runtimeConfig.appUrl.replace(/\\/+$/, '');
  return `${appUrl}/workspace?weekly_report=1#weekly_report_token=${encodeURIComponent(token)}`;
};""",
)
replace_once(
    'server/weeklyReportService.ts',
    "  const appUrl = escapeHtml(runtimeConfig.appUrl);",
    "  const reportUrl = escapeHtml(input.reportUrl);",
)
replace_once(
    'server/weeklyReportService.ts',
    "    `Посмотреть прогресс: ${runtimeConfig.appUrl}`,",
    "    `Посмотреть прогресс: ${input.reportUrl}`,",
)
replace_once(
    'server/weeklyReportService.ts',
    '<a href="${appUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;padding:13px 22px;border-radius:14px">Посмотреть прогресс</a>',
    '<a href="${reportUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;padding:13px 22px;border-radius:14px">Открыть отчёт в кабинете</a>',
)
replace_once(
    'server/weeklyReportService.ts',
    """    `select id,
            weekly_report_email as email,
            coalesce(nullif(child_display_name, ''), username, 'Ребёнок') as learner_name
       from public.profiles
      where weekly_report_email is not null
        and btrim(weekly_report_email) <> ''
        and (role = 'parent' or account_mode = 'parent')
        and subscription_tier = 'premium'
        and (premium_expires_at is null or premium_expires_at > now())
      order by id`,""",
    """    `select p.id,
            coalesce(nullif(p.weekly_report_email, ''), u.email) as email,
            coalesce(nullif(p.child_display_name, ''), p.username, 'Ребёнок') as learner_name
       from public.profiles p
       join public.app_users u on u.id = p.id
      where p.weekly_report_email is distinct from ''
        and (p.role = 'parent' or p.account_mode = 'parent')
        and p.child_display_name is not null
        and btrim(p.child_display_name) <> ''
        and p.subscription_tier = 'premium'
        and (p.premium_expires_at is null or p.premium_expires_at > now())
      order by p.id`,""",
)
replace_once(
    'server/weeklyReportService.ts',
    "      const content = buildReportContent({\n        learnerName: profile.learner_name || 'Ребёнок',",
    "      const reportUrl = await issueWeeklyReportAccessUrl(profile.id);\n      const content = buildReportContent({\n        learnerName: profile.learner_name || 'Ребёнок',\n        reportUrl,",
)

# Weekly-report tokens reuse the magic-link confirmation endpoint, but can only
# be redeemed for a parent profile and are consumed exactly once.
replace_once(
    'server/routes/magicLinkRoutes.ts',
    "import { ensureAccountActionTokenSchema } from '../accountActionTokenSchema';",
    "import { ensureAccountActionTokenSchema } from '../accountActionTokenSchema';\nimport { writeParentAccessCookie } from '../parentAccess';",
)
route = Path('server/routes/magicLinkRoutes.ts')
route_text = route.read_text()
confirm_at = route_text.index("magicLinkRouter.post('/magic-link/confirm'")
start = route_text.index("    const userId = await transaction(async client => {", confirm_at)
end_marker = "    res.json({ ...makeSessionPayload(user, sessionToken), ok: true, message: 'Вход выполнен.' });"
end = route_text.index(end_marker, start) + len(end_marker)
replacement = """    const action = await transaction(async client => {
      const result = await client.query<{ user_id: string; purpose: 'magic_login' | 'weekly_report_access' }>(
        `select t.user_id, t.purpose
           from account_action_tokens t
           join profiles p on p.id = t.user_id
          where t.token_hash = $1
            and t.purpose in ('magic_login', 'weekly_report_access')
            and t.used_at is null
            and t.expires_at > now()
            and (t.purpose = 'magic_login' or p.role = 'parent' or p.account_mode = 'parent')
          for update of t`,
        [tokenHash],
      );
      const row = result.rows[0];
      if (!row) return null;
      if (row.purpose === 'magic_login') {
        await client.query('update app_users set email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = $1', [row.user_id]);
      }
      await client.query(
        'update account_action_tokens set used_at = now() where user_id = $1 and purpose = $2 and used_at is null',
        [row.user_id, row.purpose],
      );
      return row;
    });
    if (!action) {
      res.status(400).json({ code: 'magic_link_expired', error: 'Ссылка истекла или уже использована.' });
      return;
    }
    const user = await findUserById(action.user_id);
    if (!user) {
      res.status(404).json({ code: 'magic_link_user_missing', error: 'Аккаунт не найден.' });
      return;
    }
    const sessionToken = createSessionToken(user);
    writeSessionCookie(res, sessionToken);
    if (action.purpose === 'weekly_report_access') {
      writeParentAccessCookie(res, user.id);
      res.json({
        ...makeSessionPayload(user, sessionToken),
        ok: true,
        accountMode: 'parent',
        redirectTo: '/workspace?weekly_report=1',
        message: 'Отчёт открыт.',
      });
      return;
    }
    res.json({ ...makeSessionPayload(user, sessionToken), ok: true, message: 'Вход выполнен.' });"""
route.write_text(route_text[:start] + replacement + route_text[end:])

replace_once(
    'services/magicLinkService.ts',
    "  accountMode?: 'player' | 'parent' | 'teacher' | null;\n}",
    "  accountMode?: 'player' | 'parent' | 'teacher' | null;\n  redirectTo?: string;\n}",
)
replace_once(
    'services/magicLinkService.ts',
    "export interface MagicLinkConfirmation { message: string; accountMode?: 'player' | 'parent' | 'teacher' | null; }",
    "export interface MagicLinkConfirmation { message: string; accountMode?: 'player' | 'parent' | 'teacher' | null; redirectTo?: string; }",
)
replace_once(
    'services/magicLinkService.ts',
    "    return { message: result.message || 'Email подтверждён. Вход выполнен.', accountMode: result.accountMode };",
    "    return { message: result.message || 'Email подтверждён. Вход выполнен.', accountMode: result.accountMode, redirectTo: result.redirectTo };",
)

Path('components/auth/MagicLinkOverlay.tsx').write_text("""import React, { useEffect, useMemo, useState } from 'react';
import { magicLinkService } from '../../services/magicLinkService';
import { StableStatusSlot } from '../ui/StatusNotice';
import { clearRegistrationIntent, registrationEntryPathForMode } from '../../services/registrationIntent';

type LinkToken = { token: string; kind: 'magic' | 'weekly_report' };

const readToken = (): LinkToken | null => {
  if (typeof window === 'undefined') return null;
  const url = new URL(window.location.href);
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
  const weeklyReportToken = hashParams.get('weekly_report_token')?.trim() || '';
  if (weeklyReportToken) return { token: weeklyReportToken, kind: 'weekly_report' };
  const magicToken = url.searchParams.get('magic_link_token')?.trim() || '';
  return magicToken ? { token: magicToken, kind: 'magic' } : null;
};

const clearToken = (kind: LinkToken['kind']): void => {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (kind === 'weekly_report') {
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    hashParams.delete('weekly_report_token');
    const nextHash = hashParams.toString();
    url.hash = nextHash ? `#${nextHash}` : '';
  } else {
    url.searchParams.delete('magic_link_token');
  }
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}` || '/');
};

export const MagicLinkOverlay: React.FC = () => {
  const linkToken = useMemo(readToken, []);
  const token = linkToken?.token || '';
  const weeklyReport = linkToken?.kind === 'weekly_report';
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(token ? 'loading' : 'idle');
  const [message, setMessage] = useState<string | null>(null);
  const [accountMode, setAccountMode] = useState<'player' | 'parent' | 'teacher' | null>(null);

  useEffect(() => {
    if (!token || !linkToken) return;
    let cancelled = false;
    magicLinkService.confirm(token)
      .then(result => {
        if (cancelled) return;
        clearToken(linkToken.kind);
        if (result.redirectTo) {
          window.location.replace(result.redirectTo);
          return;
        }
        setMessage(result.message);
        setAccountMode(result.accountMode || null);
        setStatus('success');
      })
      .catch(problem => {
        if (cancelled) return;
        clearToken(linkToken.kind);
        setMessage(problem instanceof Error ? problem.message : 'Ссылка недействительна или уже использована.');
        setStatus('error');
      });
    return () => { cancelled = true; };
  }, [linkToken, token]);

  if (!linkToken) return null;

  const finish = () => {
    clearRegistrationIntent();
    const entryPath = registrationEntryPathForMode(accountMode);
    window.location.assign(entryPath === 'home' ? '/' : `/${entryPath}`);
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="magic-link-title" className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="text-xs font-black uppercase tracking-widest text-indigo-500">AnnWord</div>
        <h1 id="magic-link-title" className="mt-2 text-2xl font-black text-indigo-950">{weeklyReport ? 'Открываем отчёт' : 'Подтверждение входа'}</h1>
        <p className="mt-3 text-sm font-bold leading-relaxed text-slate-600">
          {status === 'loading' ? (weeklyReport ? 'Проверяем безопасную ссылку и открываем кабинет родителя…' : 'Проверяем одноразовую ссылку и подтверждаем email…') : status === 'success' ? 'Аккаунт подтверждён.' : 'Не удалось подтвердить ссылку.'}
        </p>
        <div className="mt-4">
          <StableStatusSlot message={message} tone={status === 'success' ? 'success' : status === 'error' ? 'error' : 'info'} role={status === 'error' ? 'alert' : 'status'} />
        </div>
        {status !== 'loading' && <button type="button" onClick={finish} className="mt-4 w-full rounded-2xl bg-indigo-600 px-4 py-3 font-black text-white">{status === 'success' ? 'Продолжить в AnnWord' : 'Вернуться ко входу'}</button>}
      </section>
    </div>
  );
};
""")

# Let a valid parent-access cookie resume the parent room without asking for PIN again.
family = Path('server/routes/familyRoutes.ts')
family_text = family.read_text()
marker = 'familyRouter.post("/access-check", async (req: AuthenticatedRequest, res) => {'
if family_text.count(marker) != 1:
    raise SystemExit('familyRoutes: access-check marker mismatch')
resume_route = """familyRouter.get(\"/adult-room\", requireParentAccess, async (req: AuthenticatedRequest, res) => {
  try {
    const learners = await loadManagedLearners(req.user!.id);
    res.setHeader(\"Cache-Control\", \"private, no-store\");
    res.json({ ok: true, learners, backendReady: true, parentAccessExpiresIn: 15 * 60 });
  } catch (error) {
    res.status(400).json({ code: \"adult_room_resume_failed\", error: error instanceof Error ? error.message : \"Не удалось открыть кабинет родителя.\" });
  }
});

"""
family.write_text(family_text.replace(marker, resume_route + marker, 1))

replace_once(
    'services/familyAccountService.ts',
    """  async openAdultRoom(pin: string): Promise<MentorRoomLoadResult> {
    const normalizedPin = validateParentPin(pin);
    const data = await backendApiRequest<AdultRoomResponse>('/api/family/adult-room', {
      method: 'POST',
      body: { accessCode: normalizedPin },
    });
    const result = normalizeMentorRoomResult(data);
    return mentorRoomService.primeLearners(result);
  },
""",
    """  async openAdultRoom(pin: string): Promise<MentorRoomLoadResult> {
    const normalizedPin = validateParentPin(pin);
    const data = await backendApiRequest<AdultRoomResponse>('/api/family/adult-room', {
      method: 'POST',
      body: { accessCode: normalizedPin },
    });
    const result = normalizeMentorRoomResult(data);
    return mentorRoomService.primeLearners(result);
  },

  async resumeAdultRoom(): Promise<MentorRoomLoadResult> {
    const data = await backendApiRequest<AdultRoomResponse>('/api/family/adult-room');
    const result = normalizeMentorRoomResult(data);
    return mentorRoomService.primeLearners(result);
  },
""",
)

replace_once(
    'components/screens/ParentDashboardScreen.tsx',
    "import React, { useEffect, useMemo, useState } from 'react';",
    "import React, { useEffect, useMemo, useRef, useState } from 'react';",
)
replace_once(
    'components/screens/ParentDashboardScreen.tsx',
    "  const trialPremium = premium && Boolean(userProfile.kidsTrialStartedAt && userProfile.kidsTrialExpiresAt);\n  const [unlocked, setUnlocked] = useState(false);",
    """  const trialPremium = premium && Boolean(userProfile.kidsTrialStartedAt && userProfile.kidsTrialExpiresAt);
  const directReportRequested = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('weekly_report') === '1';
  const directReportAttempted = useRef(false);
  const [unlocked, setUnlocked] = useState(false);""",
)
replace_once(
    'components/screens/ParentDashboardScreen.tsx',
    "  const [busy, setBusy] = useState<'unlock' | 'reset' | 'load' | null>(null);",
    "  const [busy, setBusy] = useState<'unlock' | 'reset' | 'load' | null>(directReportRequested ? 'load' : null);",
)
replace_once(
    'components/screens/ParentDashboardScreen.tsx',
    "  useEffect(() => { if (unlocked && !learners.length && !loadError && busy !== 'load') void load(); }, [unlocked]);\n  useEffect(() => { if (unlocked) void loadTeacherConnections(); }, [unlocked]);",
    """  useEffect(() => { if (unlocked && !learners.length && !loadError && busy !== 'load') void load(); }, [unlocked]);
  useEffect(() => { if (unlocked) void loadTeacherConnections(); }, [unlocked]);
  useEffect(() => {
    if (!directReportRequested || directReportAttempted.current || unlocked) return;
    directReportAttempted.current = true;
    setBusy('load'); setPinError(null); setNotice(null);
    const clearMarker = () => {
      const url = new URL(window.location.href);
      url.searchParams.delete('weekly_report');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}` || '/workspace');
    };
    familyAccountService.resumeAdultRoom()
      .then(result => {
        applyLearners(result.learners);
        setTab('overview');
        setUnlocked(true);
        clearMarker();
      })
      .catch(error => {
        clearMarker();
        setPinError(error instanceof Error ? error.message : 'Ссылка на отчёт больше не активна. Введите PIN родителя.');
      })
      .finally(() => setBusy(null));
  }, [directReportRequested, unlocked]);""",
)
replace_once(
    'components/screens/ParentDashboardScreen.tsx',
    "  if (!unlocked) return <ScreenContainer",
    "  if (!unlocked && directReportRequested && busy === 'load') return <ScreenContainer className=\"max-w-md pb-24 pt-5\"><SectionCard><ExperienceState kind=\"loading\" title=\"Открываю отчёт\" description=\"Проверяем безопасную ссылку из письма…\" /></SectionCard></ScreenContainer>;\n\n  if (!unlocked) return <ScreenContainer",
)

Path('db/yandex/20260917_weekly_report_default_email.sql').write_text("""-- Weekly reports are enabled by default for parent accounts and use the account email.
-- Under the previous semantics NULL also represented an explicit opt-out. If a profile
-- has a historical delivery but is NULL now, preserve that known opt-out as ''.
DO $$
BEGIN
  IF to_regclass('public.weekly_report_delivery_log') IS NOT NULL THEN
    UPDATE public.profiles p
       SET weekly_report_email = '', updated_at = now()
     WHERE p.weekly_report_email IS NULL
       AND EXISTS (
         SELECT 1
           FROM public.weekly_report_delivery_log d
          WHERE d.profile_id = p.id
       );
  END IF;
END $$;

UPDATE public.profiles p
   SET weekly_report_email = u.email,
       updated_at = now()
  FROM public.app_users u
 WHERE u.id = p.id
   AND p.weekly_report_email IS NULL
   AND (p.role = 'parent' OR p.account_mode = 'parent');
""")

Path('tests/weeklyReportDirectAccess.test.ts').write_text("""import { readFileSync } from 'node:fs';
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
""")
