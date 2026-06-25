alter table public.app_users
  add column if not exists yandex_id text,
  add column if not exists email_confirmed_at timestamptz,
  add column if not exists password_reset_required boolean not null default false;

create unique index if not exists app_users_yandex_id_unique
  on public.app_users(yandex_id)
  where yandex_id is not null;

alter table public.app_users
  drop constraint if exists app_users_provider_check;

alter table public.app_users
  add constraint app_users_provider_check
  check (provider in ('email', 'yandex', 'supabase'));
