import { query } from './db';
import { getProfileById } from './profileRepository';
import type { UserProfile } from '../types';

export interface WeeklyReportPreferenceStatus {
  enabled: boolean;
  email: string | null;
  accountEmail: string;
  latestDelivery: null | {
    weekKey: string;
    status: 'processing' | 'sent' | 'failed';
    attemptedAt: string;
    sentAt: string | null;
    error: string | null;
  };
}

export async function updateWeeklyReportEmailPreference(userId: string, enabled: boolean, accountEmail: string): Promise<UserProfile> {
  const normalized = accountEmail.trim().toLowerCase();
  if (enabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('В аккаунте не указан корректный email для отчёта.');
  }

  const result = await query(
    `update public.profiles
        set weekly_report_email = case when $2::boolean then $3 else null end,
            updated_at = now()
      where id = $1
      returning id`,
    [userId, enabled, normalized],
  );
  if (!result.rows[0]) throw new Error('Профиль не найден.');
  const profile = await getProfileById(userId);
  if (!profile) throw new Error('Профиль не найден.');
  return profile;
}

export async function getWeeklyReportPreferenceStatus(userId: string): Promise<WeeklyReportPreferenceStatus> {
  const profileResult = await query<{ weekly_report_email: string | null; account_email: string }>(
    `select p.weekly_report_email, u.email as account_email
       from public.profiles p
       join public.app_users u on u.id = p.id
      where p.id = $1`,
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
    accountEmail: profile.account_email,
    latestDelivery: delivery ? {
      weekKey: delivery.week_key,
      status: delivery.status,
      attemptedAt: new Date(delivery.attempted_at).toISOString(),
      sentAt: delivery.sent_at ? new Date(delivery.sent_at).toISOString() : null,
      error: delivery.error,
    } : null,
  };
}
