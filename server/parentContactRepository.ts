import { query } from './db';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizeParentContactEmail = (rawEmail: unknown): string | null => {
  const normalized = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!normalized) return null;
  if (normalized.length > 254 || !EMAIL_PATTERN.test(normalized)) {
    throw new Error('Введите корректный email родителя.');
  }
  return normalized;
};

export async function getParentContactEmail(userId: string): Promise<string | null> {
  const result = await query<{ email: string }>(
    `select email
       from public.parent_contact_preferences
      where user_id = $1`,
    [userId],
  );
  return result.rows[0]?.email || null;
}

export async function updateParentContactEmail(userId: string, rawEmail: unknown): Promise<string | null> {
  const email = normalizeParentContactEmail(rawEmail);
  if (!email) {
    await query('delete from public.parent_contact_preferences where user_id = $1', [userId]);
    return null;
  }

  await query(
    `insert into public.parent_contact_preferences (user_id, email)
     values ($1, $2)
     on conflict (user_id) do update
       set email = excluded.email,
           updated_at = now()`,
    [userId, email],
  );
  return email;
}
