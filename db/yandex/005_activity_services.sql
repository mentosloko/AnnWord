create table if not exists public.daily_quests (
  user_id uuid not null,
  quest_date date not null,
  kind text not null,
  progress jsonb not null default '{}'::jsonb,
  completed boolean not null default false,
  completed_at timestamptz,
  reward_item_id text,
  reward_world_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, quest_date)
);

create index if not exists daily_quests_date_idx on public.daily_quests(quest_date desc);
