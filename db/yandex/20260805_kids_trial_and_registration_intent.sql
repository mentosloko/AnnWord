alter table public.profiles
  add column if not exists kids_trial_started_at timestamptz,
  add column if not exists kids_trial_expires_at timestamptz;

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
);

alter table public.pending_email_registrations
  add column if not exists intended_account_mode text;

alter table public.pending_email_registrations
  drop constraint if exists pending_email_registrations_intended_account_mode_check;

alter table public.pending_email_registrations
  add constraint pending_email_registrations_intended_account_mode_check
  check (intended_account_mode is null or intended_account_mode in ('player', 'parent', 'teacher'));

create index if not exists profiles_kids_trial_expires_idx
  on public.profiles(kids_trial_expires_at desc)
  where kids_trial_expires_at is not null;
