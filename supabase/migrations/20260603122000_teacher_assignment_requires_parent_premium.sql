-- Teacher-created dictionaries remain a referral/teaching feature, but a child can
-- receive custom words only while the family's Premium access is active.

create or replace function public.assign_dictionary_collection_to_learner(p_learner_user_id uuid, p_collection_id text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_profile public.profiles;
  v_collection jsonb;
  v_words text[];
  v_id uuid;
  v_existing jsonb;
  v_merged jsonb;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select * into v_profile from public.profiles where id = auth.uid();
  if v_profile.role <> 'teacher' then raise exception 'Teacher role required'; end if;
  if not exists (
    select 1 from public.adult_learner_links
    where adult_user_id = auth.uid()
      and learner_user_id = p_learner_user_id
      and relation_role = 'teacher'
  ) then raise exception 'Learner unavailable'; end if;
  if not public.has_active_premium(p_learner_user_id) then
    raise exception 'Для назначения словаря ребёнку нужен активный Premium семьи.';
  end if;
  select item into v_collection
    from jsonb_array_elements(coalesce(v_profile.dictionary_collections, '[]'::jsonb)) item
    where item->>'id' = p_collection_id
    limit 1;
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
    from (
      select value from jsonb_array_elements_text(coalesce(v_existing, '[]'::jsonb)) value
      union all
      select word from unnest(v_words) word
    ) words;
  perform set_config('annword.dictionary_write', 'allowed', true);
  update public.profiles set custom_dictionary_en = v_merged where id = p_learner_user_id;
  return v_id;
end;
$$;

revoke execute on function public.assign_dictionary_collection_to_learner(uuid, text) from public, anon;
grant execute on function public.assign_dictionary_collection_to_learner(uuid, text) to authenticated;
notify pgrst, 'reload schema';
