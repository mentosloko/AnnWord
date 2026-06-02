-- FEATURE BRANCH ONLY: do not apply to production until reviewed.
-- Makes assigned adult word sets immediately available in the learner game dictionary.

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
  v_existing jsonb;
  v_merged jsonb;
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
  select array_agg(distinct upper(trim(word))) into v_words
  from unnest(coalesce(p_words, '{}'::text[])) word
  where trim(word) ~ '^[A-Za-z][A-Za-z''-]{1,}$';
  if coalesce(cardinality(v_words), 0) = 0 then
    raise exception 'Word set cannot be empty';
  end if;

  insert into public.assigned_word_sets(adult_user_id, learner_user_id, title, class_label, theme, source, words)
  values (auth.uid(), p_learner_user_id, coalesce(nullif(trim(p_title), ''), 'Слова для тренировки'),
    nullif(trim(p_class_label), ''), nullif(trim(p_theme), ''), p_source, v_words)
  returning id into v_id;

  select custom_dictionary_en into v_existing from public.profiles where id = p_learner_user_id for update;
  select coalesce(jsonb_agg(distinct value), '[]'::jsonb) into v_merged
  from (
    select value from jsonb_array_elements_text(coalesce(v_existing, '[]'::jsonb)) current_words(value)
    union all
    select word from unnest(v_words) added_words(word)
  ) all_words;
  update public.profiles set custom_dictionary_en = v_merged, updated_at = now() where id = p_learner_user_id;
  return v_id;
end;
$$;
