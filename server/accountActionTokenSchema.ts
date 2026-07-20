import { query } from './db';

let ready: Promise<void> | null = null;

export function ensureAccountActionTokenSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await query(`
        create table if not exists public.account_action_tokens (
          id uuid primary key default gen_random_uuid(),
          user_id uuid not null references public.app_users(id) on delete cascade,
          token_hash text not null unique,
          purpose text not null,
          expires_at timestamptz not null,
          used_at timestamptz,
          created_at timestamptz not null default now()
        )
      `);
      await query(`
        create index if not exists account_action_tokens_user_purpose_created_idx
          on public.account_action_tokens (user_id, purpose, created_at desc)
      `);
      await query(`
        create index if not exists account_action_tokens_active_idx
          on public.account_action_tokens (expires_at)
          where used_at is null
      `);
    })().catch(error => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

if (process.env.NODE_ENV !== 'test') {
  void ensureAccountActionTokenSchema().catch(error => {
    console.error('Account action token schema failed', error);
  });
}
