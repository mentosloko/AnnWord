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

create table if not exists public.analytics_events (
  id bigserial primary key,
  user_id uuid,
  session_id text,
  event_type text not null,
  event_name text not null,
  game_type text,
  route text,
  occurred_at timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  app_version text,
  user_agent text,
  device_type text,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_user_time_idx on public.analytics_events(user_id, occurred_at desc);
create index if not exists analytics_events_name_time_idx on public.analytics_events(event_name, occurred_at desc);

create table if not exists public.game_events (
  id bigserial primary key,
  user_id uuid not null,
  event_key text not null unique,
  event_type text not null,
  game_mode text,
  word text,
  result text,
  quest_date date,
  quest_kind text,
  coins_delta integer not null default 0,
  xp_delta integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists game_events_user_time_idx on public.game_events(user_id, occurred_at desc);
create index if not exists game_events_word_idx on public.game_events(word);
