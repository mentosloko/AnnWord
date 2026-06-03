-- Public-release CJM slice: one child inside the parent's authenticated account.
-- The child plays through the parent's login; teachers attach to that learner by share code.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists child_display_name text,
  add column if not exists child_share_code text,
  add column if not exists parent_pin_hash text,
  add column if not exists child_slots_limit smallint not null default 1,
  add column if not exists premium_expires_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_child_slots_limit_check,
  add constraint profiles_child_slots_limit_check check (child_slots_limit between 1 and 99);

create unique index if not exists profiles_child_share_code_unique
  on public.profiles (upper(child_share_code)) where child_share_code is not null;

create or replace function public.has_active_premium(p_user_id uuid default auth.uid())
returns boolean language sql security definer set search_path = public stable as $$
  select coalesce(subscription_tier = 'premium'
    and (premium_expires_at is null or premium_expires_at > now()), false)
  from public.profiles where id = p_user_id;
$$;

create or replace function public.create_single_child_profile(p_child_name text, p_parent_pin text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles;
  v_name text := nullif(trim(p_child_name), '');
  v_code text;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if v_name is null or char_length(v_name) > 40 then raise exception 'Укажите имя ребёнка.'; end if;
  if coalesce(trim(p_parent_pin), '') !~ '^[0-9]{4}$' then raise exception 'PIN должен состоять из 4 цифр.'; end if;
  select * into v_profile from public.profiles where id = auth.uid() for update;
  if v_profile.role = 'teacher' then raise exception 'Teacher account cannot create a child profile'; end if;
  if v_profile.child_display_name is not null then raise exception 'В тестовой версии доступен один ребёнок.'; end if;
  loop
    v_code := upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8));
    exit when not exists (select 1 from public.profiles where upper(child_share_code) = v_code);
  end loop;
  perform set_config('annword.rc_admin_write', 'allowed', true);
  update public.profiles
     set role = 'parent',
         feature_flags = jsonb_set(coalesce(feature_flags, '{}'::jsonb), '{adultRoom}', 'true'::jsonb, true),
         child_display_name = v_name,
         child_share_code = v_code,
         parent_pin_hash = crypt(trim(p_parent_pin), gen_salt('bf')),
         child_slots_limit = 1
   where id = auth.uid();
  return jsonb_build_object('child_name', v_name, 'child_share_code', v_code, 'child_slots_limit', 1);
end;
$$;

create or replace function public.verify_parent_pin(p_pin text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_hash text;
begin
  if auth.uid() is null then return false; end if;
  select parent_pin_hash into v_hash from public.profiles where id = auth.uid() and role = 'parent';
  return v_hash is not null and v_hash = crypt(coalesce(trim(p_pin), ''), v_hash);
end;
$$;

create or replace function public.connect_teacher_to_child_by_code(p_child_code text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_learner uuid;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'teacher') then raise exception 'Teacher role required'; end if;
  select id into v_learner from public.profiles
   where upper(child_share_code) = upper(trim(p_child_code)) and role = 'parent' and child_display_name is not null;
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
declare v_result jsonb; v_role text;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select role into v_role from public.profiles where id = auth.uid();
  if v_role = 'parent' then
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', p.id,
      'name', p.child_display_name,
      'stats', p.stats,
      'assigned_words', coalesce(p.custom_dictionary_en, '[]'::jsonb),
      'child_share_code', p.child_share_code
    )), '[]'::jsonb) into v_result
    from public.profiles p where p.id = auth.uid() and p.child_display_name is not null;
    return v_result;
  end if;
  if v_role <> 'teacher' then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', learner.id,
    'name', learner.child_display_name,
    'class_label', link.class_label,
    'stats', learner.stats,
    'assigned_words', coalesce(learner.custom_dictionary_en, '[]'::jsonb)
  ) order by learner.child_display_name), '[]'::jsonb) into v_result
  from public.adult_learner_links link
  join public.profiles learner on learner.id = link.learner_user_id
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
  if v_profile.role <> 'teacher' then raise exception 'Teacher role required'; end if;
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
  if v_profile.role <> 'teacher' and not public.has_active_premium(auth.uid()) then raise exception 'Premium required'; end if;
  if p_source = 'ocr' and v_profile.role = 'teacher' and not public.has_active_premium(auth.uid()) then raise exception 'OCR for teachers will be available later'; end if;
  if p_source not in ('manual', 'ocr', 'class', 'topic') then raise exception 'Invalid source'; end if;
  select array_agg(distinct upper(trim(word)) order by upper(trim(word))) into v_words from unnest(coalesce(p_words, '{}'::text[])) word where trim(word) ~ '^[A-Za-z][A-Za-z''-]{1,}$';
  if coalesce(cardinality(v_words), 0) = 0 then raise exception 'Word set cannot be empty'; end if;
  v_collection := jsonb_build_object('id', gen_random_uuid(), 'title', coalesce(nullif(trim(p_title), ''), 'Новый словарь'), 'source', p_source, 'classLabel', nullif(trim(p_class_label), ''), 'theme', nullif(trim(p_theme), ''), 'words', to_jsonb(v_words), 'createdAt', now());
  update public.profiles set dictionary_collections = coalesce(dictionary_collections, '[]'::jsonb) || jsonb_build_array(v_collection), custom_dictionary_en = case when role = 'parent' then to_jsonb(v_words) else custom_dictionary_en end where id = auth.uid();
  return v_collection;
end;
$$;

grant execute on function public.create_single_child_profile(text, text) to authenticated;
grant execute on function public.verify_parent_pin(text) to authenticated;
grant execute on function public.connect_teacher_to_child_by_code(text) to authenticated;
grant execute on function public.get_managed_learner_word_stats() to authenticated;
grant execute on function public.assign_dictionary_collection_to_learner(uuid, text) to authenticated;
grant execute on function public.has_active_premium(uuid) to authenticated;
notify pgrst, 'reload schema';
