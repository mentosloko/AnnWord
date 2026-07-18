import { query } from "./db";
import { runYandexSchemaMigrations } from "./yandexSchemaMigrations";

export async function ensureConsentSchema(): Promise<void> {
  await runYandexSchemaMigrations();

  await query(`
    create table if not exists public.user_consents (
      id bigserial primary key,
      user_id uuid not null references public.app_users(id) on delete cascade,
      consent_type text not null check (consent_type in (
        'user_agreement',
        'personal_data',
        'marketing_email',
        'child_personal_data'
      )),
      granted boolean not null,
      document_version text not null,
      source text not null default 'web',
      context jsonb not null default '{}'::jsonb,
      accepted_at timestamptz not null default now(),
      revoked_at timestamptz,
      created_at timestamptz not null default now()
    )
  `);

  await query(`
    create index if not exists user_consents_user_type_accepted_idx
      on public.user_consents (user_id, consent_type, accepted_at desc)
  `);

  await query(`
    create index if not exists user_consents_marketing_current_idx
      on public.user_consents (user_id, accepted_at desc)
      where consent_type = 'marketing_email'
  `);
}
