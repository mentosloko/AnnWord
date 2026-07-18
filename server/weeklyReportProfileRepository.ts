import { query } from './db';
import { isRussianRegistrationEmail } from './emailPolicy';
import { getProfileById } from './profileRepository';
import type { UserProfile } from '../types';

export interface WeeklyReportPreferenceStatus {
  enabled: boolean;
  email: string | null;
  latestDelivery: null | {
    weekKey: string;
    status: 'processing' | 'sent' | 'failed';
    attemptedAt: string;
    sentAt: string | null;
    error: string | null;
  };
}

export async function updateWeeklyReportEmailPreference(userId: string, rawEmail: string): Promise<UserProfile> {
  const normalized = rawEmail.trim().toLowerCase();
  if (normalized && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Введите корректный email для отчёта.');
  }
  if (normalized && !isRussianRegistrationEmail(normalized)) {
    throw new Error('Отчёт можно отправлять только на адрес в зоне .ru или .рф.');
  }

  const result = await query(
    `update public.profiles
        set weekly_report_email = nullif($2, ''),
            updated_at = now()
      where id = $1
      returning id`,
    [userId, normalized],
  );
  if (!result.rows[0]) throw new Error('Профиль не найден.');
  const profile = await getProfileById(userId);
  if (!profile) throw new Error('Профиль не найден.');
  return profile;
}

export async function getWeeklyReportPreferenceStatus(userId: string): Promise<WeeklyReportPreferenceStatus> {
  const profileResult = await query<{ weekly_report_email: string | null }>(
    `select weekly_report_email from public.profiles where id = $1`,
    [userId],
  );
  const profile = profileResult.rows[0];
  if (!profile) throw new Error('Профиль не найден.');

  const deliveryResult = await query<{
    week_key: string;
    status: 'processing' | 'sent' | 'failed';
    attempted_at: Date | string;
    sent_at: Date | string | null;
    error: string | null;
  }>(
    `select week_key, status, attempted_at, sent_at, error
       from public.weekly_report_delivery_log
      where profile_id = $1
      order by updated_at desc
      limit 1`,
    [userId],
  );
  const delivery = deliveryResult.rows[0];
  return {
    enabled: Boolean(profile.weekly_report_email?.trim()),
    email: profile.weekly_report_email || null,
    latestDelivery: delivery ? {
      weekKey: delivery.week_key,
      status: delivery.status,
      attemptedAt: new Date(delivery.attempted_at).toISOString(),
      sentAt: delivery.sent_at ? new Date(delivery.sent_at).toISOString() : null,
      error: delivery.error,
    } : null,
  };
}
