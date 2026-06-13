-- Keep Teacher workflows working for users whose profile is marked by account_mode.

create or replace function public.connect_teacher_to_child_by_code(p_child_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_learner uuid;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and (role = 'teacher' or account_mode = 'teacher')) then raise exception 'Teacher role required'; end if;
  select id into v_learner from public.profiles
   where upper(child_share_code) = upper(trim(p_child_code)) and (role = 'parent' or account_mode = 'parent') and child_display_name is not null;
  if v_learner is null then raise exception 'Код ребёнка не найден.'; end if;
  if exists (select 1 from public.adult_learner_links where learner_user_id = v_learner and relation_role = 'teacher' and adult_user_id <> auth.uid()) then
    raise exception 'К ребёнку уже подключён преподаватель.';
  end if;
  insert into public.adult_learner_links(adult_user_id, learner_user_id, relation_role)
  values (auth.uid(), v_learner, 'teacher')
  on conflict (adult_user_id, learner_user_id) do update set relation_role = 'teacher';
  return true;
end;
$$;

create or replace function public.get_managed_learner_word_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_result jsonb; v_role text; v_mode text;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select role, account_mode into v_role, v_mode from public.profiles where id = auth.uid();
  if v_role = 'parent' or v_mode = 'parent' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.child_display_name, 'stats', p.stats,
      'assigned_words', coalesce(p.custom_dictionary_en, '[]'::jsonb),
      'child_share_code', p.child_share_code
    )), '[]'::jsonb) into v_result
    from public.profiles p where p.id = auth.uid() and p.child_display_name is not null;
    return v_result;
  end if;
  if not (v_role = 'teacher' or v_mode = 'teacher') then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', learner.id, 'name', learner.child_display_name, 'class_label', link.class_label,
    'stats', learner.stats, 'assigned_words', coalesce(learner.custom_dictionary_en, '[]'::jsonb)
  ) order by learner.child_display_name), '[]'::jsonb) into v_result
  from public.adult_learner_links link join public.profiles learner on learner.id = link.learner_user_id
  where link.adult_user_id = auth.uid() and link.relation_role = 'teacher';
  return v_result;
end;
$$;

create or replace function public.assign_dictionary_collection_to_learner(p_learner_user_id uuid, p_collection_id text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles; v_collection jsonb; v_words text[]; v_id uuid; v_existing jsonb; v_merged jsonb;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select * into v_profile from public.profiles where id = auth.uid();
  if not (v_profile.role = 'teacher' or v_profile.account_mode = 'teacher') then raise exception 'Teacher role required'; end if;
  if not exists (select 1 from public.adult_learner_links where adult_user_id = auth.uid() and learner_user_id = p_learner_user_id and relation_role = 'teacher') then raise exception 'Learner unavailable'; end if;
  select item into v_collection from jsonb_array_elements(coalesce(v_profile.dictionary_collections, '[]'::jsonb)) item where item->>'id' = p_collection_id limit 1;
  if v_collection is null then raise exception 'Выберите сохранённый словарь.'; end if;
  select array_agg(distinct upper(trim(word)) order by upper(trim(word))) into v_words
    from jsonb_array_elements_text(coalesce(v_collection->'words', '[]'::jsonb)) word
    where trim(word) ~ '^[A-Za-z][A-Za-z''-]{1,}$';
  if coalesce(cardinality(v_words), 0) = 0 then raise exception 'В словаре нет слов для назначения.'; end if;
  insert into public.assigned_word_sets(adult_user_id, learner_user_id, title, source, words)
  values (auth.uid(), p_learner_user_id, coalesce(nullif(v_collection->>'title', ''), 'Слова преподавателя'), 'class', v_words)
  returning id into v_id;
  select custom_dictionary_en into v_existing from public.profiles where id = p_learner_user_id for update;
  select coalesce(jsonb_agg(distinct value order by value), '[]'::jsonb) into v_merged
  from (select value from jsonb_array_elements_text(coalesce(v_existing, '[]'::jsonb)) value union all select word from unnest(v_words) word) words;
  perform set_config('annword.dictionary_write', 'allowed', true);
  update public.profiles set custom_dictionary_en = v_merged where id = p_learner_user_id;
  return v_id;
end;
$$;

create or replace function public.save_premium_dictionary_collection(
  p_title text, p_words text[], p_source text default 'manual', p_class_label text default null, p_theme text default null
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles; v_words text[]; v_collection jsonb;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if not (v_profile.role = 'teacher' or v_profile.account_mode = 'teacher' or v_profile.role = 'admin' or public.has_active_premium(auth.uid())) then raise exception 'Premium required'; end if;
  if p_source = 'ocr' and (v_profile.role = 'teacher' or v_profile.account_mode = 'teacher') then raise exception 'Teacher OCR unavailable'; end if;
  if p_source not in ('manual', 'ocr', 'class', 'topic') then raise exception 'Invalid source'; end if;
  select array_agg(distinct upper(trim(word)) order by upper(trim(word))) into v_words from unnest(coalesce(p_words, '{}'::text[])) word where trim(word) ~ '^[A-Za-z][A-Za-z''-]{1,}$';
  if coalesce(cardinality(v_words), 0) = 0 then raise exception 'Word set cannot be empty'; end if;
  v_collection := jsonb_build_object('id', gen_random_uuid(), 'title', coalesce(nullif(trim(p_title), ''), 'Новый словарь'), 'source', p_source, 'classLabel', nullif(trim(p_class_label), ''), 'theme', nullif(trim(p_theme), ''), 'words', to_jsonb(v_words), 'createdAt', now());
  perform set_config('annword.dictionary_write', 'allowed', true);
  update public.profiles set dictionary_collections = coalesce(dictionary_collections, '[]'::jsonb) || jsonb_build_array(v_collection), custom_dictionary_en = case when not (role = 'teacher' or account_mode = 'teacher') then to_jsonb(v_words) else custom_dictionary_en end where id = auth.uid();
  return v_collection;
end;
$$;

notify pgrst, 'reload schema';
