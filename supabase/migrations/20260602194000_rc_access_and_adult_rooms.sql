-- Gated release-candidate infrastructure. New functions remain invisible until enabled per profile.

alter table public.profiles
  add column if not exists subscription_tier text not null default 'free',
  add column if not exists feature_flags jsonb not null default '{}'::jsonb,
  add column if not exists dictionary_collections jsonb not null default '[]'::jsonb,
  add column if not exists weekly_report_email text;

alter table public.profiles
  drop constraint if exists profiles_role_check,
  add constraint profiles_role_check check (role in ('admin', 'user', 'parent', 'teacher')),
  drop constraint if exists profiles_subscription_tier_check,
  add constraint profiles_subscription_tier_check check (subscription_tier in ('free', 'premium'));

alter table public.daily_quests
  add column if not exists reward_world_id text;
alter table public.daily_quests
  drop constraint if exists daily_quests_reward_world_id_check,
  add constraint daily_quests_reward_world_id_check check (
    reward_world_id is null or reward_world_id in ('theatre', 'amusement_park', 'ice_rink', 'opera', 'sausage_fridge')
  );

create table if not exists public.adult_learner_links (
  adult_user_id uuid not null references public.profiles(id) on delete cascade,
  learner_user_id uuid not null references public.profiles(id) on delete cascade,
  relation_role text not null check (relation_role in ('parent', 'teacher')),
  class_label text,
  created_at timestamptz not null default now(),
  primary key (adult_user_id, learner_user_id),
  check (adult_user_id <> learner_user_id)
);

create table if not exists public.assigned_word_sets (
  id uuid primary key default gen_random_uuid(),
  adult_user_id uuid not null references public.profiles(id) on delete cascade,
  learner_user_id uuid not null references public.profiles(id) on delete cascade,
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
  adult_user_id uuid not null references public.profiles(id) on delete cascade,
  learner_user_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  enabled boolean not null default true,
  weekday smallint not null default 1 check (weekday between 0 and 6),
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (adult_user_id, learner_user_id)
);

create table if not exists public.weekly_report_outbox (
  id uuid primary key default gen_random_uuid(),
  adult_user_id uuid not null references public.profiles(id) on delete cascade,
  learner_user_id uuid not null references public.profiles(id) on delete cascade,
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

drop policy if exists "Adults read own learner links" on public.adult_learner_links;
create policy "Adults read own learner links" on public.adult_learner_links for select to authenticated using (adult_user_id = auth.uid());
drop policy if exists "Adults read own assigned word sets" on public.assigned_word_sets;
create policy "Adults read own assigned word sets" on public.assigned_word_sets for select to authenticated using (adult_user_id = auth.uid());
drop policy if exists "Learners read assigned word sets" on public.assigned_word_sets;
create policy "Learners read assigned word sets" on public.assigned_word_sets for select to authenticated using (learner_user_id = auth.uid());
drop policy if exists "Adults read own weekly subscriptions" on public.weekly_report_subscriptions;
create policy "Adults read own weekly subscriptions" on public.weekly_report_subscriptions for select to authenticated using (adult_user_id = auth.uid());
drop policy if exists "Adults read own report outbox" on public.weekly_report_outbox;
create policy "Adults read own report outbox" on public.weekly_report_outbox for select to authenticated using (adult_user_id = auth.uid());

create or replace function public.protect_rc_access_fields()
returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('annword.rc_admin_write', true), '') <> 'allowed' then
    new.role := old.role;
    new.subscription_tier := old.subscription_tier;
    new.feature_flags := old.feature_flags;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_rc_access_fields on public.profiles;
create trigger protect_rc_access_fields before update on public.profiles for each row execute function public.protect_rc_access_fields();

create or replace function public.is_annword_admin(p_user_id uuid default auth.uid())
returns boolean language sql security definer set search_path = public stable as $$
  select exists(select 1 from public.profiles where id = p_user_id and role = 'admin');
$$;

create or replace function public.admin_list_rc_profiles()
returns table(id uuid, username text, role text, subscription_tier text, feature_flags jsonb)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_annword_admin() then raise exception 'Unauthorized'; end if;
  return query select p.id, p.username, p.role, p.subscription_tier, p.feature_flags from public.profiles p order by p.username;
end;
$$;

create or replace function public.admin_set_rc_access(p_username text, p_role text, p_premium boolean, p_feature_flags jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles;
begin
  if not public.is_annword_admin() then raise exception 'Unauthorized'; end if;
  if p_role not in ('admin', 'user', 'parent', 'teacher') then raise exception 'Invalid role'; end if;
  perform set_config('annword.rc_admin_write', 'allowed', true);
  update public.profiles set role = p_role, subscription_tier = case when p_premium then 'premium' else 'free' end, feature_flags = coalesce(p_feature_flags, '{}'::jsonb)
    where lower(username) = lower(trim(p_username)) returning * into v_profile;
  if not found then raise exception 'Profile not found'; end if;
  return to_jsonb(v_profile);
end;
$$;

create or replace function public.admin_link_learner(p_adult_username text, p_learner_username text, p_relation_role text, p_class_label text default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_adult uuid; v_learner uuid;
begin
  if not public.is_annword_admin() then raise exception 'Unauthorized'; end if;
  if p_relation_role not in ('parent', 'teacher') then raise exception 'Invalid relation'; end if;
  select id into v_adult from public.profiles where lower(username) = lower(trim(p_adult_username));
  select id into v_learner from public.profiles where lower(username) = lower(trim(p_learner_username));
  if v_adult is null or v_learner is null then raise exception 'Profile not found'; end if;
  insert into public.adult_learner_links(adult_user_id, learner_user_id, relation_role, class_label)
    values (v_adult, v_learner, p_relation_role, nullif(trim(p_class_label), ''))
    on conflict (adult_user_id, learner_user_id) do update set relation_role = excluded.relation_role, class_label = excluded.class_label;
  return true;
end;
$$;

grant execute on function public.admin_list_rc_profiles() to authenticated;
grant execute on function public.admin_set_rc_access(text, text, boolean, jsonb) to authenticated;
grant execute on function public.admin_link_learner(text, text, text, text) to authenticated;
notify pgrst, 'reload schema';
