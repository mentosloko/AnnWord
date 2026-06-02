-- FEATURE BRANCH ONLY: do not apply to production until reviewed.
-- Parent/teacher room, premium dictionary collections, world rewards, streak stickers and weekly email report queue.

alter table public.profiles
  add column if not exists subscription_tier text not null default 'free'
    check (subscription_tier in ('free', 'premium')),
  add column if not exists weekly_report_email text,
  add column if not exists dictionary_collections jsonb not null default '[]'::jsonb;

alter table public.daily_quests
  add column if not exists reward_world_id text
    check (reward_world_id is null or reward_world_id in ('theatre', 'amusement_park', 'ice_rink', 'opera', 'sausage_fridge'));

create table if not exists public.adult_learner_links (
  adult_user_id uuid not null references auth.users(id) on delete cascade,
  learner_user_id uuid not null references auth.users(id) on delete cascade,
  relation_role text not null check (relation_role in ('parent', 'teacher')),
  class_label text,
  created_at timestamptz not null default now(),
  primary key (adult_user_id, learner_user_id),
  check (adult_user_id <> learner_user_id)
);

create table if not exists public.assigned_word_sets (
  id uuid primary key default gen_random_uuid(),
  adult_user_id uuid not null references auth.users(id) on delete cascade,
  learner_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  class_label text,
  theme text,
  source text not null default 'manual' check (source in ('manual', 'ocr', 'class', 'topic')),
  words text[] not null default '{}',
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint assigned_word_sets_non_empty check (cardinality(words) > 0)
);

create table if not exists public.weekly_report_subscriptions (
  adult_user_id uuid not null references auth.users(id) on delete cascade,
  learner_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  enabled boolean not null default true,
  weekday smallint not null default 1 check (weekday between 0 and 6),
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (adult_user_id, learner_user_id)
);

create table if not exists public.weekly_report_outbox (
  id uuid primary key default gen_random_uuid(),
  adult_user_id uuid not null references auth.users(id) on delete cascade,
  learner_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  week_start date not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'failed')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (adult_user_id, learner_user_id, week_start)
);

alter table public.adult_learner_links enable row level security;
alter table public.assigned_word_sets enable row level security;
alter table public.weekly_report_subscriptions enable row level security;
alter table public.weekly_report_outbox enable row level security;

create policy "Adults manage own learner links" on public.adult_learner_links
  for all to authenticated using (adult_user_id = auth.uid()) with check (adult_user_id = auth.uid());
create policy "Adults manage own assigned word sets" on public.assigned_word_sets
  for all to authenticated using (adult_user_id = auth.uid()) with check (adult_user_id = auth.uid());
create policy "Adults manage own weekly subscriptions" on public.weekly_report_subscriptions
  for all to authenticated using (adult_user_id = auth.uid()) with check (adult_user_id = auth.uid());
create policy "Adults read own report outbox" on public.weekly_report_outbox
  for select to authenticated using (adult_user_id = auth.uid());

create or replace function public.get_managed_learner_word_stats()
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', learner.id,
    'name', learner.username,
    'class_label', link.class_label,
    'stats', learner.stats,
    'assigned_words', coalesce((select to_jsonb(array_agg(distinct word)) from public.assigned_word_sets sets, unnest(sets.words) word where sets.adult_user_id = auth.uid() and sets.learner_user_id = learner.id and sets.archived_at is null), '[]'::jsonb)
  )), '[]'::jsonb)
  from public.adult_learner_links link
  join public.profiles learner on learner.id = link.learner_user_id
  where link.adult_user_id = auth.uid();
$$;

create or replace function public.unlock_daily_world_reward(p_user_id uuid, p_quest_date date)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_world text;
  v_pet jsonb;
begin
  if auth.uid() is null or p_user_id <> auth.uid() then raise exception 'Unauthorized'; end if;
  v_world := (array['theatre','amusement_park','ice_rink','opera','sausage_fridge'])[1 + mod(abs(hashtextextended(p_user_id::text || ':' || p_quest_date::text || ':world', 0))::numeric, 5)::int];
  update public.daily_quests set reward_world_id = v_world where user_id = p_user_id and quest_date = p_quest_date and completed = true;
  select pet into v_pet from public.profiles where id = p_user_id for update;
  v_pet := jsonb_set(coalesce(v_pet, '{}'::jsonb), '{unlockedWorldIds}', coalesce(v_pet->'unlockedWorldIds', '["default_room"]'::jsonb) || to_jsonb(v_world), true);
  update public.profiles set pet = v_pet, updated_at = now() where id = p_user_id;
  return v_world;
end;
$$;

-- The eventual apply_daily_quest_result function should call unlock_daily_world_reward
-- instead of issuing an inventory treat for the daily reward, and return new_reward_world_id.
