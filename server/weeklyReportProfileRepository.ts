import { query } from './db';
import { isRussianRegistrationEmail } from './emailPolicy';
import { getProfileById } from './profileRepository';
import type { UserProfile } from '../types';

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
