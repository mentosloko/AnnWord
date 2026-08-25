alter table public.app_users
  add column if not exists session_version integer not null default 1;

create table if not exists public.teacher_connection_invites (
  id uuid primary key default gen_random_uuid(),
  learner_user_id uuid not null references public.profiles(id) on delete cascade,
  code_hash text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by_teacher_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists teacher_connection_invites_learner_created_idx
  on public.teacher_connection_invites(learner_user_id, created_at desc);

alter table public.adult_learner_links
  add column if not exists revoked_at timestamptz;

create index if not exists adult_learner_links_active_teacher_idx
  on public.adult_learner_links(learner_user_id, adult_user_id)
  where relation_role = 'teacher' and revoked_at is null;
