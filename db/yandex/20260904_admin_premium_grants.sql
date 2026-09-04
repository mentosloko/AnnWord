create table if not exists public.admin_premium_grants (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.profiles(id) on delete restrict,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  granted_days integer not null check (granted_days between 1 and 365),
  previous_expires_at timestamptz,
  new_expires_at timestamptz not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists admin_premium_grants_target_created_idx
  on public.admin_premium_grants(target_user_id, created_at desc);

create index if not exists admin_premium_grants_admin_created_idx
  on public.admin_premium_grants(admin_user_id, created_at desc);
