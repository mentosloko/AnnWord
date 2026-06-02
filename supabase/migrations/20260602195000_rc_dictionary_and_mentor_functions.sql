-- Server operations for the gated parent/teacher room and Premium dictionary studio.

create or replace function public.rc_feature_enabled(p_user_id uuid, p_feature text)
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce((feature_flags->>p_feature)::boolean, false)
  from public.profiles where id = p_user_id;
$$;

create or replace function public.get_managed_learner_word_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb;
begin
  if auth.uid() is null or not public.rc_feature_enabled(auth.uid(), 'adultRoom') then
    raise exception 'Feature unavailable';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', learner.id,
    'name', learner.username,
    'class_label', link.class_label,
    'stats', learner.stats,
    'assigned_words', coalesce((
      select to_jsonb(array_agg(distinct word order by word))
      from public.assigned_word_sets sets, unnest(sets.words) word
      where sets.adult_user_id = auth.uid() and sets.learner_user_id = learner.id and sets.archived_at is null
    ), '[]'::jsonb)
  ) order by learner.username), '[]'::jsonb) into v_result
  from public.adult_learner_links link
  join public.profiles learner on learner.id = link.learner_user_id
  where link.adult_user_id = auth.uid();
  return v_result;
end;
$$;

create or replace function public.assign_managed_words(
  p_learner_user_id uuid,
  p_title text,
  p_words text[],
  p_source text default 'manual',
  p_class_label text default null,
  p_theme text default null
)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_words text[]; v_existing jsonb; v_merged jsonb;
begin
  if auth.uid() is null or not public.rc_feature_enabled(auth.uid(), 'adultRoom') then raise exception 'Feature unavailable'; end if;
  if not exists (select 1 from public.adult_learner_links where adult_user_id = auth.uid() and learner_user_id = p_learner_user_id) then raise exception 'Learner unavailable'; end if;
  if p_source not in ('manual', 'ocr', 'class', 'topic') then raise exception 'Invalid source'; end if;
  select array_agg(distinct upper(trim(word)) order by upper(trim(word))) into v_words
  from unnest(coalesce(p_words, '{}'::text[])) word
  where trim(word) ~ '^[A-Za-z][A-Za-z''-]{1,}$';
  if coalesce(cardinality(v_words), 0) = 0 then raise exception 'Word set cannot be empty'; end if;
  insert into public.assigned_word_sets(adult_user_id, learner_user_id, title, class_label, theme, source, words)
  values(auth.uid(), p_learner_user_id, coalesce(nullif(trim(p_title), ''), 'Слова для тренировки'), nullif(trim(p_class_label), ''), nullif(trim(p_theme), ''), p_source, v_words)
  returning id into v_id;
  select custom_dictionary_en into v_existing from public.profiles where id = p_learner_user_id for update;
  select coalesce(jsonb_agg(distinct value order by value), '[]'::jsonb) into v_merged
  from (select value from jsonb_array_elements_text(coalesce(v_existing, '[]'::jsonb)) value union all select word from unnest(v_words) word) words;
  update public.profiles set custom_dictionary_en = v_merged where id = p_learner_user_id;
  return v_id;
end;
$$;

create or replace function public.save_weekly_report_subscription(p_learner_user_id uuid, p_email text, p_enabled boolean default true)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.rc_feature_enabled(auth.uid(), 'adultRoom') then raise exception 'Feature unavailable'; end if;
  if not exists (select 1 from public.adult_learner_links where adult_user_id = auth.uid() and learner_user_id = p_learner_user_id) then raise exception 'Learner unavailable'; end if;
  if p_enabled and coalesce(trim(p_email), '') !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Invalid email'; end if;
  insert into public.weekly_report_subscriptions(adult_user_id, learner_user_id, email, enabled, weekday)
  values(auth.uid(), p_learner_user_id, lower(trim(p_email)), p_enabled, 1)
  on conflict(adult_user_id, learner_user_id) do update set email = excluded.email, enabled = excluded.enabled;
  return true;
end;
$$;

create or replace function public.save_premium_dictionary_collection(
  p_title text, p_words text[], p_source text default 'manual', p_class_label text default null, p_theme text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles; v_words text[]; v_collection jsonb;
begin
  if auth.uid() is null or not public.rc_feature_enabled(auth.uid(), 'premiumDictionaries') then raise exception 'Feature unavailable'; end if;
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if v_profile.subscription_tier <> 'premium' and v_profile.role not in ('admin', 'parent', 'teacher') then raise exception 'Premium required'; end if;
  if p_source not in ('manual', 'ocr', 'class', 'topic') then raise exception 'Invalid source'; end if;
  select array_agg(distinct upper(trim(word)) order by upper(trim(word))) into v_words from unnest(coalesce(p_words, '{}'::text[])) word where trim(word) ~ '^[A-Za-z][A-Za-z''-]{1,}$';
  if coalesce(cardinality(v_words), 0) = 0 then raise exception 'Word set cannot be empty'; end if;
  v_collection := jsonb_build_object('id', gen_random_uuid(), 'title', coalesce(nullif(trim(p_title), ''), 'Новый словарь'), 'source', p_source, 'classLabel', nullif(trim(p_class_label), ''), 'theme', nullif(trim(p_theme), ''), 'words', to_jsonb(v_words), 'createdAt', now());
  update public.profiles set dictionary_collections = coalesce(dictionary_collections, '[]'::jsonb) || jsonb_build_array(v_collection), custom_dictionary_en = to_jsonb(v_words) where id = auth.uid();
  return v_collection;
end;
$$;

grant execute on function public.get_managed_learner_word_stats() to authenticated;
grant execute on function public.assign_managed_words(uuid, text, text[], text, text, text) to authenticated;
grant execute on function public.save_weekly_report_subscription(uuid, text, boolean) to authenticated;
grant execute on function public.save_premium_dictionary_collection(text, text[], text, text, text) to authenticated;
notify pgrst, 'reload schema';
