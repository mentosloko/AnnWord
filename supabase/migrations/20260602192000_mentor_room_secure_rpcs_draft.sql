-- FEATURE BRANCH ONLY: do not apply to production until reviewed.
-- Complete role expansion and authenticated write operations for the adult room / Premium dictionaries.

alter table public.profiles
  drop constraint if exists profiles_role_check,
  add constraint profiles_role_check check (role in ('admin', 'user', 'parent', 'teacher'));

create or replace function public.is_adult_profile(p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and role in ('admin', 'parent', 'teacher')
  );
$$;

create or replace function public.assign_managed_words(
  p_learner_user_id uuid,
  p_title text,
  p_words text[],
  p_source text default 'manual',
  p_class_label text default null,
  p_theme text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_words text[];
begin
  if auth.uid() is null or not public.is_adult_profile(auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  if not exists (
    select 1 from public.adult_learner_links
    where adult_user_id = auth.uid() and learner_user_id = p_learner_user_id
  ) then
    raise exception 'Learner is not assigned to current adult';
  end if;
  if p_source not in ('manual', 'ocr', 'class', 'topic') then
    raise exception 'Invalid source';
  end if;
  select array_agg(distinct upper(trim(word)))
    into v_words
  from unnest(coalesce(p_words, '{}'::text[])) word
  where trim(word) ~ '^[A-Za-z][A-Za-z''-]{1,}$';
  if coalesce(cardinality(v_words), 0) = 0 then
    raise exception 'Word set cannot be empty';
  end if;
  insert into public.assigned_word_sets(
    adult_user_id, learner_user_id, title, class_label, theme, source, words
  ) values (
    auth.uid(), p_learner_user_id, coalesce(nullif(trim(p_title), ''), 'Слова для тренировки'),
    nullif(trim(p_class_label), ''), nullif(trim(p_theme), ''), p_source, v_words
  ) returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.save_weekly_report_subscription(
  p_learner_user_id uuid,
  p_email text,
  p_enabled boolean default true
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_adult_profile(auth.uid()) then
    raise exception 'Unauthorized';
  end if;
  if not exists (
    select 1 from public.adult_learner_links
    where adult_user_id = auth.uid() and learner_user_id = p_learner_user_id
  ) then
    raise exception 'Learner is not assigned to current adult';
  end if;
  if p_enabled and coalesce(trim(p_email), '') !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'Invalid email';
  end if;
  insert into public.weekly_report_subscriptions(
    adult_user_id, learner_user_id, email, enabled, weekday
  ) values (
    auth.uid(), p_learner_user_id, lower(trim(p_email)), p_enabled, 1
  )
  on conflict (adult_user_id, learner_user_id)
  do update set email = excluded.email, enabled = excluded.enabled;
  return true;
end;
$$;

create or replace function public.save_premium_dictionary_collection(
  p_title text,
  p_words text[],
  p_source text default 'manual',
  p_class_label text default null,
  p_theme text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_words text[];
  v_collection jsonb;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if v_profile.subscription_tier <> 'premium' and v_profile.role not in ('admin', 'parent', 'teacher') then
    raise exception 'Premium required';
  end if;
  if p_source not in ('manual', 'ocr', 'class', 'topic') then raise exception 'Invalid source'; end if;
  select array_agg(distinct upper(trim(word))) into v_words
  from unnest(coalesce(p_words, '{}'::text[])) word
  where trim(word) ~ '^[A-Za-z][A-Za-z''-]{1,}$';
  if coalesce(cardinality(v_words), 0) = 0 then raise exception 'Word set cannot be empty'; end if;
  v_collection := jsonb_build_object(
    'id', gen_random_uuid(),
    'title', coalesce(nullif(trim(p_title), ''), 'Новый словарь'),
    'source', p_source,
    'classLabel', nullif(trim(p_class_label), ''),
    'theme', nullif(trim(p_theme), ''),
    'words', to_jsonb(v_words),
    'createdAt', now()
  );
  update public.profiles
    set dictionary_collections = coalesce(dictionary_collections, '[]'::jsonb) || jsonb_build_array(v_collection),
        custom_dictionary_en = to_jsonb(v_words),
        updated_at = now()
  where id = auth.uid();
  return v_collection;
end;
$$;

revoke all on function public.assign_managed_words(uuid, text, text[], text, text, text) from public;
revoke all on function public.save_weekly_report_subscription(uuid, text, boolean) from public;
revoke all on function public.save_premium_dictionary_collection(text, text[], text, text, text) from public;
grant execute on function public.get_managed_learner_word_stats() to authenticated;
grant execute on function public.assign_managed_words(uuid, text, text[], text, text, text) to authenticated;
grant execute on function public.save_weekly_report_subscription(uuid, text, boolean) to authenticated;
grant execute on function public.save_premium_dictionary_collection(text, text[], text, text, text) to authenticated;
