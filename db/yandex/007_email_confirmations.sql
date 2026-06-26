create table if not exists public.email_confirmations (
  code_hash text primary key,
  email text not null,
  full_name text,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists email_confirmations_email_created_idx
  on public.email_confirmations (lower(email), created_at desc);

create index if not exists email_confirmations_expires_idx
  on public.email_confirmations (expires_at);