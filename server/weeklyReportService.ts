import { query } from './db';
import { runtimeConfig } from './config';
import { loadMasterDictionaryTranslations } from '../services/masterDictionaryLookup';

interface ReportProfileRow {
  id: string;
  email: string;
  learner_name: string | null;
}

interface ReportMetricsRow {
  games_played: number | string;
  mastered: number | string;
  failed: number | string;
  active_days: number | string;
  favorite_game: string | null;
  favorite_game_count: number | string;
}

interface WordProgressRow {
  word: string;
  mastered_count: number | string;
  failed_count: number | string;
  last_mastered_at: Date | string | null;
  last_failed_at: Date | string | null;
}

interface MetadataTokenResponse {
  access_token?: string;
  expires_in?: number;
}

interface DeliveryResult {
  MessageId?: string;
  messageId?: string;
}

export interface WeeklyReportWord {
  word: string;
  translation: string;
  count?: number;
}

export interface WeeklyReportContentInput {
  learnerName: string;
  periodStart: Date;
  periodEnd: Date;
  games: number;
  activeDays: number;
  mastered: number;
  failed: number;
  confidentWordCount: number;
  learnedWords: WeeklyReportWord[];
  difficultWords: WeeklyReportWord[];
  favoriteGame: string | null;
  favoriteGameCount: number;
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
const MODE_LABELS: Record<string, string> = {
  wordle: 'Классика',
  sprint: 'Спринт',
  anagram: 'Анаграммы',
  translation: '1 из 2',
  memory: 'Память',
  hangman: 'Виселица',
  letterSquare: 'Змейка',
  letter_square: 'Змейка',
};
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
const dateMs = (value: Date | string | null): number => value ? new Date(value).getTime() || 0 : 0;
const ruPlural = (value: number, one: string, few: string, many: string): string => {
  const absolute = Math.abs(value) % 100;
  const last = absolute % 10;
  if (absolute > 10 && absolute < 20) return many;
  if (last === 1) return one;
  if (last >= 2 && last <= 4) return few;
  return many;
};
const modeLabel = (mode: string | null): string | null => mode ? MODE_LABELS[mode] || mode : null;

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

const statusCopy = (activeDays: number, accuracy: number | null): { title: string; text: string } => {
  if (activeDays === 0) return {
    title: 'Можно начать с малого',
    text: 'На этой неделе тренировок ещё не было. Даже одна короткая игра — хороший способ вернуться в ритм.',
  };
  if (activeDays >= 4 && (accuracy ?? 0) >= 75) return {
    title: 'Отличная неделя!',
    text: `Получился хороший ритм: ${activeDays} ${ruPlural(activeDays, 'день', 'дня', 'дней')} занятий и уверенная работа со словами.`,
  };
  if (activeDays >= 3) return {
    title: 'Хорошая неделя!',
    text: `${activeDays} ${ruPlural(activeDays, 'день', 'дня', 'дней')} занятий — уже устойчивый ритм. Продолжайте короткими регулярными тренировками.`,
  };
  return {
    title: 'Неделя в движении',
    text: `Было ${activeDays} ${ruPlural(activeDays, 'день', 'дня', 'дней')} занятий. На следующей неделе можно добавить ещё один короткий подход.`,
  };
};

const buildAdvice = (activeDays: number, accuracy: number | null, difficultWords: WeeklyReportWord[]): string => {
  const focus = difficultWords.slice(0, 3).map(item => item.word).join(', ');
  if (activeDays === 0) return 'Начните с 5–10 минут в любой любимой игре. Для возвращения в ритм важнее регулярность, чем длинная тренировка.';
  if (difficultWords.length > 0) {
    return `Хорошая цель — 10 минут 3–4 раза за неделю. Начните со слов ${focus}: AnnWord будет возвращать их в упражнения для повторения.`;
  }
  if (accuracy !== null && accuracy < 65) return 'Лучше сделать несколько коротких повторений знакомых слов, чем одну длинную тренировку. Цель — 10 минут 3–4 раза за неделю.';
  if (activeDays < 3) return 'Попробуйте добавить ещё один короткий день занятий. Даже 5–10 минут помогают лучше удерживать слова в памяти.';
  return 'Сохраняйте ритм: 10 минут 3–4 раза за неделю достаточно, чтобы регулярно возвращаться к школьной лексике без перегрузки.';
};

const renderWordRow = (item: WeeklyReportWord, tone: 'learned' | 'review'): string => {
  const background = tone === 'learned' ? '#ffffff' : '#fffdfa';
  const accent = tone === 'learned' ? '#047857' : '#b45309';
  const badge = tone === 'learned'
    ? '<span style="font-size:13px;color:#047857;font-weight:800">✓</span>'
    : `<span style="font-size:12px;color:#92400e;font-weight:800">${item.count || 0} ${ruPlural(item.count || 0, 'ошибка', 'ошибки', 'ошибок')}</span>`;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;background:${background};border-radius:14px;margin-top:8px"><tr><td style="padding:11px 12px"><div style="font-size:14px;font-weight:800;color:#172554;letter-spacing:.02em">${escapeHtml(item.word)}</div><div style="font-size:13px;color:#64748b;margin-top:2px">${escapeHtml(item.translation || 'перевод не указан')}</div></td><td align="right" valign="middle" style="padding:11px 12px;color:${accent};white-space:nowrap">${badge}</td></tr></table>`;
};

export const buildReportContent = (input: WeeklyReportContentInput) => {
  const attempts = input.mastered + input.failed;
  const accuracy = attempts ? Math.round(input.mastered / attempts * 100) : null;
  const period = `${formatRuDate(input.periodStart)} — ${formatRuDate(new Date(input.periodEnd.getTime() - 86_400_000))}`;
  const learner = input.learnerName || 'Ребёнок';
  const safeLearner = escapeHtml(learner);
  const status = statusCopy(input.activeDays, accuracy);
  const favorite = modeLabel(input.favoriteGame);
  const advice = buildAdvice(input.activeDays, accuracy, input.difficultWords);
  const appUrl = escapeHtml(runtimeConfig.appUrl);
  const accuracyLabel = accuracy === null ? '—' : `${accuracy}%`;
  const subject = `AnnWord: итоги недели — ${learner}`;
  const learnedSummary = input.confidentWordCount > 0
    ? `Хороший результат по ${input.confidentWordCount} ${ruPlural(input.confidentWordCount, 'слову', 'словам', 'словам')} за неделю.`
    : 'Пока недостаточно данных, чтобы уверенно выделить слова.';
  const learnedHtml = input.learnedWords.length
    ? input.learnedWords.map(item => renderWordRow(item, 'learned')).join('')
    : '<p style="margin:10px 0 0;color:#64748b;font-size:14px">Пока недостаточно данных — новые уверенные слова появятся после следующих тренировок.</p>';
  const difficultHtml = input.difficultWords.length
    ? input.difficultWords.map(item => renderWordRow(item, 'review')).join('')
    : '<p style="margin:10px 0 0;color:#64748b;font-size:14px">Нет слов, которые явно требуют дополнительного повторения.</p>';
  const favoriteHtml = favorite && input.favoriteGameCount > 0
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;background:#f5f3ff;border-radius:18px;margin-top:18px"><tr><td style="padding:18px"><div style="font-size:13px;font-weight:800;color:#7c3aed">🎮 Больше всего понравилась</div><div style="font-size:20px;font-weight:800;color:#312e81;margin-top:6px">${escapeHtml(favorite)}</div><div style="font-size:13px;color:#6d28d9;margin-top:3px">${input.favoriteGameCount} ${ruPlural(input.favoriteGameCount, 'завершённая игра', 'завершённые игры', 'завершённых игр')} за неделю</div></td></tr></table>`
    : '';

  const textLearned = input.learnedWords.length
    ? input.learnedWords.map(item => `${item.word}${item.translation ? ` — ${item.translation}` : ''}`).join(', ')
    : 'пока недостаточно данных';
  const textDifficult = input.difficultWords.length
    ? input.difficultWords.map(item => `${item.word}${item.translation ? ` — ${item.translation}` : ''} (${item.count || 0} ${ruPlural(item.count || 0, 'ошибка', 'ошибки', 'ошибок')})`).join(', ')
    : 'нет слов, которые явно требуют повторения';
  const text = [
    `AnnWord Kids — итоги недели: ${learner}`,
    `Период: ${period}`,
    status.title,
    status.text,
    `Дней занятий: ${input.activeDays}`,
    `Игр завершено: ${input.games}`,
    `Точность по словам: ${accuracyLabel}`,
    `Эти слова уже получаются: ${textLearned}`,
    `Стоит немного повторить: ${textDifficult}`,
    favorite ? `Чаще всего выбирали: ${favorite} — ${input.favoriteGameCount}` : '',
    `На следующую неделю: ${advice}`,
    `Посмотреть прогресс: ${runtimeConfig.appUrl}`,
  ].filter(Boolean).join('\n');

  const html = `<!doctype html>
<html lang="ru"><body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#172554">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f8fafc"><tr><td align="center" style="padding:20px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;max-width:640px;background:#ffffff;border-radius:26px;overflow:hidden">
<tr><td style="padding:26px 24px;background:#eef2ff">
  <div style="font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.09em;color:#6366f1">🐾 AnnWord Kids</div>
  <h1 style="font-size:28px;line-height:1.15;margin:9px 0 5px;color:#172554">Неделя ${safeLearner}</h1>
  <div style="font-size:14px;color:#64748b">${escapeHtml(period)}</div>
  <div style="font-size:20px;font-weight:800;color:#312e81;margin-top:20px">${escapeHtml(status.title)}</div>
  <div style="font-size:14px;line-height:1.55;color:#475569;margin-top:6px">${escapeHtml(status.text)}</div>
</td></tr>
<tr><td style="padding:18px 18px 0">
  <table role="presentation" width="100%" cellspacing="6" cellpadding="0" style="table-layout:fixed"><tr>
    <td width="33%" align="center" valign="top" style="background:#f8fafc;border-radius:16px;padding:15px 6px"><div style="font-size:24px;font-weight:800;color:#172554">${input.activeDays}</div><div style="font-size:11px;line-height:1.3;color:#64748b;margin-top:3px">${ruPlural(input.activeDays, 'день', 'дня', 'дней')} занятий</div></td>
    <td width="33%" align="center" valign="top" style="background:#f8fafc;border-radius:16px;padding:15px 6px"><div style="font-size:24px;font-weight:800;color:#172554">${input.games}</div><div style="font-size:11px;line-height:1.3;color:#64748b;margin-top:3px">${ruPlural(input.games, 'игра', 'игры', 'игр')} завершено</div></td>
    <td width="33%" align="center" valign="top" style="background:#ecfdf5;border-radius:16px;padding:15px 6px"><div style="font-size:24px;font-weight:800;color:#047857">${accuracyLabel}</div><div style="font-size:11px;line-height:1.3;color:#64748b;margin-top:3px">точность по словам</div></td>
  </tr></table>
</td></tr>
<tr><td style="padding:18px 24px 0">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;background:#f0fdf4;border-radius:18px"><tr><td style="padding:18px">
    <div style="font-size:15px;font-weight:800;color:#166534">🎉 Эти слова уже получаются</div>
    ${learnedHtml}
    <div style="font-size:12px;color:#15803d;margin-top:10px">${escapeHtml(learnedSummary)}</div>
  </td></tr></table>
</td></tr>
<tr><td style="padding:12px 24px 0">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;background:#fffbeb;border-radius:18px"><tr><td style="padding:18px">
    <div style="font-size:15px;font-weight:800;color:#92400e">🔁 Стоит немного повторить</div>
    ${difficultHtml}
    ${input.difficultWords.length ? '<div style="font-size:12px;line-height:1.5;color:#a16207;margin-top:10px">Не нужно учить всё заново — достаточно ещё нескольких коротких тренировок.</div>' : ''}
  </td></tr></table>
  ${favoriteHtml}
</td></tr>
<tr><td style="padding:18px 24px 0">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:separate;background:#eff6ff;border-radius:18px"><tr><td style="padding:18px">
    <div style="font-size:15px;font-weight:800;color:#1d4ed8">💡 На следующую неделю</div>
    <div style="font-size:14px;line-height:1.55;color:#334155;margin-top:7px">${escapeHtml(advice)}</div>
  </td></tr></table>
</td></tr>
<tr><td align="center" style="padding:24px">
  <a href="${appUrl}" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;padding:13px 22px;border-radius:14px">Посмотреть прогресс</a>
  <div style="font-size:11px;line-height:1.5;color:#94a3b8;margin-top:18px">Вы получаете этот отчёт, потому что еженедельные отчёты включены в родительском кабинете AnnWord. Настройки отчёта можно изменить там же.</div>
</td></tr>
</table></td></tr></table></body></html>`;

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

const loadWeeklyMetrics = async (profileId: string, start: Date, end: Date): Promise<ReportMetricsRow | undefined> => {
  const result = await query<ReportMetricsRow>(
    `with weekly as (
       select event_type, game_mode, occurred_at
         from public.game_events
        where user_id = $1
          and occurred_at >= $2
          and occurred_at < $3
     ), favorite as (
       select game_mode, count(*) as games, max(occurred_at) as latest
         from weekly
        where event_type = 'game_finished'
          and game_mode is not null
        group by game_mode
        order by games desc, latest desc
        limit 1
     )
     select count(*) filter (where event_type = 'game_finished') as games_played,
            count(*) filter (where event_type = 'word_mastered') as mastered,
            count(*) filter (where event_type = 'word_failed') as failed,
            count(distinct (occurred_at at time zone 'Europe/Moscow')::date) filter (where event_type = 'game_finished') as active_days,
            (select game_mode from favorite) as favorite_game,
            coalesce((select games from favorite), 0) as favorite_game_count
       from weekly`,
    [profileId, start.toISOString(), end.toISOString()],
  );
  return result.rows[0];
};

const loadWeeklyWordProgress = async (profileId: string, start: Date, end: Date): Promise<WordProgressRow[]> => {
  const result = await query<WordProgressRow>(
    `select word,
            count(*) filter (where event_type = 'word_mastered') as mastered_count,
            count(*) filter (where event_type = 'word_failed') as failed_count,
            max(occurred_at) filter (where event_type = 'word_mastered') as last_mastered_at,
            max(occurred_at) filter (where event_type = 'word_failed') as last_failed_at
       from public.game_events
      where user_id = $1
        and event_type in ('word_mastered', 'word_failed')
        and word is not null
        and occurred_at >= $2
        and occurred_at < $3
      group by word
      order by count(*) desc, max(occurred_at) desc
      limit 200`,
    [profileId, start.toISOString(), end.toISOString()],
  );
  return result.rows;
};

const buildWordHighlights = async (rows: WordProgressRow[]): Promise<{
  confidentWordCount: number;
  learnedWords: WeeklyReportWord[];
  difficultWords: WeeklyReportWord[];
}> => {
  const translations = rows.length ? await loadMasterDictionaryTranslations() : new Map<string, string>();
  const normalized = rows.map(row => ({
    word: row.word.trim().toUpperCase(),
    mastered: numberValue(row.mastered_count),
    failed: numberValue(row.failed_count),
    masteredAt: dateMs(row.last_mastered_at),
    failedAt: dateMs(row.last_failed_at),
  })).filter(row => Boolean(row.word));
  const confident = normalized
    .filter(row => row.mastered > 0 && row.mastered >= row.failed && row.masteredAt >= row.failedAt)
    .sort((a, b) => (b.mastered - b.failed) - (a.mastered - a.failed) || b.mastered - a.mastered || b.masteredAt - a.masteredAt);
  const review = normalized
    .filter(row => row.failed > 0 && (row.failed > row.mastered || row.failedAt > row.masteredAt))
    .sort((a, b) => (b.failed - b.mastered) - (a.failed - a.mastered) || b.failed - a.failed || b.failedAt - a.failedAt);
  return {
    confidentWordCount: confident.length,
    learnedWords: confident.slice(0, 5).map(row => ({ word: row.word, translation: translations.get(row.word) || '' })),
    difficultWords: review.slice(0, 5).map(row => ({ word: row.word, translation: translations.get(row.word) || '', count: row.failed })),
  };
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
      const [metrics, wordRows] = await Promise.all([
        loadWeeklyMetrics(profile.id, periodStart, periodEnd),
        loadWeeklyWordProgress(profile.id, periodStart, periodEnd),
      ]);
      const highlights = await buildWordHighlights(wordRows);
      const content = buildReportContent({
        learnerName: profile.learner_name || 'Ребёнок',
        periodStart,
        periodEnd,
        games: numberValue(metrics?.games_played),
        activeDays: Math.min(7, numberValue(metrics?.active_days)),
        mastered: numberValue(metrics?.mastered),
        failed: numberValue(metrics?.failed),
        confidentWordCount: highlights.confidentWordCount,
        learnedWords: highlights.learnedWords,
        difficultWords: highlights.difficultWords,
        favoriteGame: metrics?.favorite_game || null,
        favoriteGameCount: numberValue(metrics?.favorite_game_count),
      });
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
