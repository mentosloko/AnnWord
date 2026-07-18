import { query } from './db';

let ready: Promise<void> | null = null;

export function ensurePasswordResetSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await query(`
        create table if not exists public.password_reset_tokens (
          id uuid primary key default gen_random_uuid(),
          user_id uuid not null references public.app_users(id) on delete cascade,
          token_hash text not null unique,
          expires_at timestamptz not null,
          used_at timestamptz,
          created_at timestamptz not null default now()
        )
      `);
      await query(`
        create index if not exists password_reset_tokens_user_created_idx
          on public.password_reset_tokens (user_id, created_at desc)
      `);
      await query(`
        create index if not exists password_reset_tokens_active_idx
          on public.password_reset_tokens (expires_at)
          where used_at is null
      `);
    })().catch(error => {
      ready = null;
      throw error;
    });
  }
  return ready;
}
