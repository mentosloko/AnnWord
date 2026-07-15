import { query } from './db';

interface ReportProfileRow {
  id: string;
  email: string;
  learner_name: string | null;
}

interface ReportMetricsRow {
  games_played: number | string;
  mastered: number | string;
  failed: number | string;
}

interface WordCountRow {
  word: string;
}

interface MetadataTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface DeliveryResult {
  MessageId?: string;
  messageId?: string;
}

export interface WeeklyReportRunResult {
  weekKey: string;
  periodStart: string;
  periodEnd: string;
  processed: number;
  sent: number;
  skipped: number;
  failed: Array<{ profileId: string; error: string }>;
}

const METADATA_TOKEN_URL = 'http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token';
const POSTBOX_SEND_URL = 'https://postbox.cloud.yandex.net/v2/email/outbound-emails';
let tokenCache: { token: string; expiresAt: number } | null = null;

const requiredEnv = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Не задана переменная окружения ${name}.`);
  return value;
};

const startOfUtcMonday = (value = new Date()): Date => {
  const date = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date;
};

const dateKey = (value: Date): string => value.toISOString().slice(0, 10);
const formatRuDate = (value: Date): string => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(value);
const numberValue = (value: number | string | undefined): number => Math.max(0, Math.round(Number(value) || 0));
const escapeHtml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const getIamToken = async (): Promise<string> => {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) return tokenCache.token;
  const response = await fetch(METADATA_TOKEN_URL, { headers: { 'Metadata-Flavor': 'Google' } });
  if (!response.ok) throw new Error(`Не удалось получить IAM-токен: HTTP ${response.status}.`);
  const body = await response.json() as MetadataTokenResponse;
  if (!body.access_token) throw new Error('Сервис метаданных не вернул IAM-токен.');
  tokenCache = {
    token: body.access_token,
    expiresAt: Date.now() + Math.max(60, Number(body.expires_in || 300)) * 1000,
  };
  return tokenCache.token;
};

const buildReportContent = (learnerName: string, periodStart: Date, periodEnd: Date, games: number, mastered: number, failed: number, learnedWords: string[], difficultWords: string[]) => {
  const attempts = mastered + failed;
  const accuracy = attempts ? Math.round(mastered / attempts * 100) : 0;
  const period = `${formatRuDate(periodStart)} — ${formatRuDate(new Date(periodEnd.getTime() - 86_400_000))}`;
  const safeLearner = escapeHtml(learnerName || 'ребёнок');
  const learned = learnedWords.length ? learnedWords.map(escapeHtml).join(', ') : 'пока недостаточно данных';
  const difficult = difficultWords.length ? difficultWords.map(escapeHtml).join(', ') : 'нет слов с повторяющимися ошибками';
  const subject = `Отчёт AnnWord за неделю: ${learnerName || 'прогресс ребёнка'}`;
  const text = [
    `Еженедельный отчёт AnnWord — ${learnerName || 'ребёнок'}`,
    `Период: ${period}`,
    `Игр завершено: ${games}`,
    `Правильных ответов по словам: ${mastered}`,
    `Ошибок по словам: ${failed}`,
    `Точность: ${accuracy}%`,
    `Получается лучше: ${learnedWords.join(', ') || 'пока недостаточно данных'}`,
    `Стоит повторить: ${difficultWords.join(', ') || 'нет слов с повторяющимися ошибками'}`,
  ].join('\n');
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#172554;line-height:1.5">
      <div style="background:#eef2ff;border-radius:24px;padding:24px">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#6366f1">AnnWord Kids</div>
        <h1 style="font-size:28px;margin:8px 0 4px">Еженедельный отчёт</h1>
        <p style="margin:0;color:#64748b">${safeLearner} · ${escapeHtml(period)}</p>
      </div>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin:20px 0">
        <div style="flex:1;min-width:140px;background:#f8fafc;border-radius:18px;padding:16px"><strong style="font-size:28px">${games}</strong><br><span style="color:#64748b">игр завершено</span></div>
        <div style="flex:1;min-width:140px;background:#ecfdf5;border-radius:18px;padding:16px"><strong style="font-size:28px">${accuracy}%</strong><br><span style="color:#64748b">точность</span></div>
      </div>
      <div style="background:#f0fdf4;border-radius:18px;padding:18px;margin-bottom:12px"><strong>Получается лучше</strong><p style="margin:8px 0 0">${learned}</p></div>
      <div style="background:#fff1f2;border-radius:18px;padding:18px"><strong>Стоит повторить</strong><p style="margin:8px 0 0">${difficult}</p></div>
      <p style="margin-top:24px;font-size:13px;color:#64748b">Адрес отчёта можно изменить или отключить в кабинете родителя AnnWord.</p>
    </div>`;
  return { subject, text, html };
};

const sendPostboxEmail = async (to: string, content: { subject: string; text: string; html: string }): Promise<string | null> => {
  const token = await getIamToken();
  const from = requiredEnv('WEEKLY_REPORT_FROM_EMAIL');
  const response = await fetch(POSTBOX_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-YaCloud-SubjectToken': token,
    },
    body: JSON.stringify({
      FromEmailAddress: from,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: content.subject, Charset: 'UTF-8' },
          Body: {
            Text: { Data: content.text, Charset: 'UTF-8' },
            Html: { Data: content.html, Charset: 'UTF-8' },
          },
        },
      },
    }),
  });
  const responseText = await response.text();
  if (!response.ok) throw new Error(`Postbox вернул HTTP ${response.status}: ${responseText.slice(0, 500)}`);
  try {
    const parsed = JSON.parse(responseText) as DeliveryResult;
    return parsed.MessageId || parsed.messageId || null;
  } catch {
    return null;
  }
};

const loadWords = async (profileId: string, eventType: 'word_mastered' | 'word_failed', start: Date, end: Date): Promise<string[]> => {
  const result = await query<WordCountRow>(
    `select word
       from public.game_events
      where user_id = $1
        and event_type = $2
        and word is not null
        and occurred_at >= $3
        and occurred_at < $4
      group by word
      order by count(*) desc, max(occurred_at) desc
      limit 8`,
    [profileId, eventType, start.toISOString(), end.toISOString()],
  );
  return result.rows.map(row => row.word).filter(Boolean);
};

export async function runWeeklyReports(now = new Date()): Promise<WeeklyReportRunResult> {
  requiredEnv('WEEKLY_REPORT_FROM_EMAIL');
  const periodEnd = startOfUtcMonday(now);
  const periodStart = new Date(periodEnd);
  periodStart.setUTCDate(periodStart.getUTCDate() - 7);
  const weekKey = dateKey(periodEnd);
  const profiles = await query<ReportProfileRow>(
    `select id,
            weekly_report_email as email,
            coalesce(nullif(child_display_name, ''), username, 'Ребёнок') as learner_name
       from public.profiles
      where weekly_report_email is not null
        and btrim(weekly_report_email) <> ''
        and (role = 'parent' or account_mode = 'parent')
        and subscription_tier = 'premium'
        and (premium_expires_at is null or premium_expires_at > now())
      order by id`,
  );

  const result: WeeklyReportRunResult = {
    weekKey,
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    processed: profiles.rows.length,
    sent: 0,
    skipped: 0,
    failed: [],
  };

  for (const profile of profiles.rows) {
    const claim = await query<{ status: string }>(
      `insert into public.weekly_report_delivery_log (profile_id, week_key, email, status, attempted_at, updated_at)
       values ($1, $2, $3, 'processing', now(), now())
       on conflict (profile_id, week_key) do update
         set email = excluded.email,
             status = case when weekly_report_delivery_log.status = 'sent' then 'sent' else 'processing' end,
             attempted_at = case when weekly_report_delivery_log.status = 'sent' then weekly_report_delivery_log.attempted_at else now() end,
             updated_at = now()
       returning status`,
      [profile.id, weekKey, profile.email],
    );
    if (claim.rows[0]?.status === 'sent') {
      result.skipped += 1;
      continue;
    }

    try {
      const metricsResult = await query<ReportMetricsRow>(
        `select count(*) filter (where event_type = 'game_finished') as games_played,
                count(*) filter (where event_type = 'word_mastered') as mastered,
                count(*) filter (where event_type = 'word_failed') as failed
           from public.game_events
          where user_id = $1
            and occurred_at >= $2
            and occurred_at < $3`,
        [profile.id, periodStart.toISOString(), periodEnd.toISOString()],
      );
      const metrics = metricsResult.rows[0];
      const [learnedWords, difficultWords] = await Promise.all([
        loadWords(profile.id, 'word_mastered', periodStart, periodEnd),
        loadWords(profile.id, 'word_failed', periodStart, periodEnd),
      ]);
      const content = buildReportContent(
        profile.learner_name || 'Ребёнок',
        periodStart,
        periodEnd,
        numberValue(metrics?.games_played),
        numberValue(metrics?.mastered),
        numberValue(metrics?.failed),
        learnedWords,
        difficultWords,
      );
      const providerMessageId = await sendPostboxEmail(profile.email, content);
      await query(
        `update public.weekly_report_delivery_log
            set status = 'sent', provider_message_id = $3, error = null, sent_at = now(), updated_at = now()
          where profile_id = $1 and week_key = $2`,
        [profile.id, weekKey, providerMessageId],
      );
      result.sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Неизвестная ошибка отправки.';
      await query(
        `update public.weekly_report_delivery_log
            set status = 'failed', error = $3, updated_at = now()
          where profile_id = $1 and week_key = $2`,
        [profile.id, weekKey, message.slice(0, 2000)],
      ).catch(() => undefined);
      result.failed.push({ profileId: profile.id, error: message });
    }
  }

  return result;
}
