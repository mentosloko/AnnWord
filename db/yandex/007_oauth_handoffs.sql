create table if not exists public.oauth_handoffs (
  code_hash text primary key,
  user_id uuid not null references public.app_users(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists oauth_handoffs_user_created_idx
  on public.oauth_handoffs(user_id, created_at desc);

create index if not exists oauth_handoffs_expiry_idx
  on public.oauth_handoffs(expires_at)
  where consumed_at is null;
