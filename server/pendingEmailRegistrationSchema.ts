import { query } from './db';

let ready: Promise<void> | null = null;

export function ensurePendingEmailRegistrationSchema(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await query(`
        create table if not exists public.pending_email_registrations (
          email text primary key,
          password_hash text not null,
          full_name text not null,
          consents jsonb not null default '{}'::jsonb,
          intended_account_mode text,
          token_hash text not null unique,
          expires_at timestamptz not null,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        )
      `);
      await query(`alter table public.pending_email_registrations add column if not exists intended_account_mode text`);
      await query(`
        alter table public.pending_email_registrations
          drop constraint if exists pending_email_registrations_intended_account_mode_check
      `);
      await query(`
        alter table public.pending_email_registrations
          add constraint pending_email_registrations_intended_account_mode_check
          check (intended_account_mode is null or intended_account_mode in ('player', 'parent', 'teacher'))
      `);
      await query(`
        create index if not exists pending_email_registrations_expires_idx
          on public.pending_email_registrations (expires_at)
      `);
      await query(`
        create index if not exists pending_email_registrations_created_idx
          on public.pending_email_registrations (created_at desc)
      `);
    })().catch(error => {
      ready = null;
      throw error;
    });
  }
  return ready;
}

if (process.env.NODE_ENV !== 'test') {
  void ensurePendingEmailRegistrationSchema().catch(error => {
    console.error('Pending email registration schema failed', error);
  });
}
