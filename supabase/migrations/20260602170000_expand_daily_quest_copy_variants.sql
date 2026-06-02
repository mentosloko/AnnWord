-- Expand daily quest copy and difficulty variants while keeping five stable game routes.
-- Existing quests remain valid; new quests receive a progress.variant_key value.

create or replace function public.ensure_daily_quest(p_user_id uuid)
 returns public.daily_quests
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_date date := (timezone('Europe/London', now()))::date;
  v_index integer;
  v_kind text;
  v_variant_key text;
  v_progress jsonb;
  v_row public.daily_quests;
begin
  if p_user_id is null or p_user_id <> auth.uid() then raise exception 'Unauthorized'; end if;
  select * into v_row from public.daily_quests where user_id = p_user_id and quest_date = v_date;
  if found then return v_row; end if;
  v_index := mod(abs(hashtextextended(p_user_id::text || ':' || v_date::text || ':daily-quest-v2', 0))::numeric, 20)::int;
  case v_index
    when 0 then v_kind := 'wordle_four'; v_variant_key := 'wordle_two';
    when 1 then v_kind := 'wordle_four'; v_variant_key := 'wordle_three';
    when 2 then v_kind := 'wordle_four'; v_variant_key := 'wordle_four';
    when 3 then v_kind := 'wordle_four'; v_variant_key := 'wordle_win';
    when 4 then v_kind := 'sprint_twelve'; v_variant_key := 'sprint_four';
    when 5 then v_kind := 'sprint_twelve'; v_variant_key := 'sprint_six';
    when 6 then v_kind := 'sprint_twelve'; v_variant_key := 'sprint_eight';
    when 7 then v_kind := 'sprint_twelve'; v_variant_key := 'sprint_ten';
    when 8 then v_kind := 'sprint_twelve'; v_variant_key := 'sprint_twelve';
    when 9 then v_kind := 'sprint_twelve'; v_variant_key := 'sprint_fourteen';
    when 10 then v_kind := 'memory_sixteen'; v_variant_key := 'memory_twelve';
    when 11 then v_kind := 'memory_sixteen'; v_variant_key := 'memory_fourteen';
    when 12 then v_kind := 'memory_sixteen'; v_variant_key := 'memory_sixteen';
    when 13 then v_kind := 'memory_sixteen'; v_variant_key := 'memory_eighteen';
    when 14 then v_kind := 'memory_sixteen'; v_variant_key := 'memory_twenty';
    when 15 then v_kind := 'hangman_clean'; v_variant_key := 'hangman_perfect';
    when 16 then v_kind := 'hangman_clean'; v_variant_key := 'hangman_one';
    when 17 then v_kind := 'hangman_clean'; v_variant_key := 'hangman_clean';
    when 18 then v_kind := 'hangman_clean'; v_variant_key := 'hangman_win';
    else v_kind := 'all_five_games'; v_variant_key := 'all_five_games';
  end case;
  v_progress := jsonb_build_object('variant_key', v_variant_key);
  if v_kind = 'all_five_games' then v_progress := v_progress || '{"completed_modes":[],"anagram_words":0}'::jsonb; end if;
  insert into public.daily_quests(user_id, quest_date, kind, progress) values (p_user_id, v_date, v_kind, v_progress) returning * into v_row;
  return v_row;
end;
$function$;

create or replace function public.get_daily_quest()
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_row public.daily_quests;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  v_row := public.ensure_daily_quest(auth.uid());
  return jsonb_build_object(
    'quest_date', v_row.quest_date,
    'kind', v_row.kind,
    'variant_key', coalesce(v_row.progress->>'variant_key', v_row.kind),
    'completed', v_row.completed,
    'completed_at', v_row.completed_at,
    'reward_item_id', v_row.reward_item_id,
    'completed_modes', coalesce(v_row.progress->'completed_modes','[]'::jsonb),
    'progress', v_row.progress
  );
end;
$function$;

create or replace function public.apply_daily_quest_result(p_game_type text, p_result jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_row public.daily_quests;
  v_variant_key text;
  v_progress jsonb;
  v_qualifies boolean := false;
  v_mode_qualifies boolean := false;
  v_modes jsonb;
  v_anagrams integer;
  v_target integer;
  v_item_id text;
  v_item_name text;
  v_item_image text;
  v_inventory jsonb;
  v_has_item boolean;
  v_profile public.profiles;
begin
  if v_uid is null then raise exception 'Unauthorized'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_uid::text || ':' || (timezone('Europe/London', now()))::date::text, 0));
  v_row := public.ensure_daily_quest(v_uid);
  select * into v_row from public.daily_quests where user_id = v_uid and quest_date = v_row.quest_date for update;
  v_variant_key := coalesce(v_row.progress->>'variant_key', v_row.kind);
  if v_row.completed then
    select * into v_profile from public.profiles where id = v_uid;
    return jsonb_build_object('quest', public.get_daily_quest(), 'new_reward_item_id', null, 'profile', to_jsonb(v_profile));
  end if;
  if v_row.kind = 'wordle_four' then
    if v_variant_key = 'wordle_win' then
      v_qualifies := p_game_type = 'wordle' and coalesce((p_result->>'won')::boolean, false);
    else
      v_target := case v_variant_key when 'wordle_two' then 2 when 'wordle_three' then 3 else 4 end;
      v_qualifies := p_game_type = 'wordle' and coalesce((p_result->>'won')::boolean, false) and coalesce((p_result->>'attempts')::integer, 99) <= v_target;
    end if;
  elsif v_row.kind = 'sprint_twelve' then
    v_target := case v_variant_key when 'sprint_four' then 4 when 'sprint_six' then 6 when 'sprint_eight' then 8 when 'sprint_ten' then 10 when 'sprint_fourteen' then 14 else 12 end;
    v_qualifies := p_game_type = 'sprint' and coalesce((p_result->>'guessedWords')::integer, 0) >= v_target;
  elsif v_row.kind = 'memory_sixteen' then
    v_target := case v_variant_key when 'memory_twelve' then 12 when 'memory_fourteen' then 14 when 'memory_eighteen' then 18 when 'memory_twenty' then 20 else 16 end;
    v_qualifies := p_game_type = 'memory' and coalesce((p_result->>'clicks')::integer, 999) <= v_target;
  elsif v_row.kind = 'hangman_clean' then
    if v_variant_key = 'hangman_win' then
      v_qualifies := p_game_type = 'hangman' and coalesce((p_result->>'won')::boolean, false);
    else
      v_target := case v_variant_key when 'hangman_perfect' then 0 when 'hangman_one' then 1 else 2 end;
      v_qualifies := p_game_type = 'hangman' and coalesce((p_result->>'won')::boolean, false) and coalesce((p_result->>'mistakes')::integer, 99) <= v_target;
    end if;
  else
    v_progress := coalesce(v_row.progress, '{"variant_key":"all_five_games","completed_modes":[],"anagram_words":0}'::jsonb);
    v_anagrams := coalesce((v_progress->>'anagram_words')::integer, 0);
    if p_game_type = 'anagram' then
      v_anagrams := v_anagrams + greatest(0, coalesce((p_result->>'guessedWords')::integer, 0));
      v_progress := jsonb_set(v_progress, '{anagram_words}', to_jsonb(v_anagrams));
      v_mode_qualifies := v_anagrams >= 5;
    elsif p_game_type = 'wordle' then v_mode_qualifies := coalesce((p_result->>'won')::boolean, false);
    elsif p_game_type = 'sprint' then v_mode_qualifies := coalesce((p_result->>'guessedWords')::integer, 0) >= 6;
    elsif p_game_type = 'memory' then v_mode_qualifies := (p_result ? 'clicks');
    elsif p_game_type = 'hangman' then v_mode_qualifies := coalesce((p_result->>'won')::boolean, false);
    end if;
    v_modes := coalesce(v_progress->'completed_modes', '[]'::jsonb);
    if v_mode_qualifies and not (v_modes ? p_game_type) then
      v_modes := v_modes || to_jsonb(p_game_type);
      v_progress := jsonb_set(v_progress, '{completed_modes}', v_modes);
    end if;
    update public.daily_quests set progress = v_progress where user_id = v_uid and quest_date = v_row.quest_date returning * into v_row;
    v_qualifies := jsonb_array_length(coalesce(v_progress->'completed_modes', '[]'::jsonb)) >= 5;
  end if;
  if v_qualifies then
    v_item_id := case floor(random() * 5)::int when 0 then 'apple' when 1 then 'cookie' when 2 then 'berry' when 3 then 'icecream' else 'star_treat' end;
    select case v_item_id when 'apple' then 'Энерго-яблоко' when 'cookie' then 'Хрустик' when 'berry' then 'Сияющая ягодка' when 'icecream' then 'Ледяной десерт' else 'Звёздный кристалл' end,
      case v_item_id when 'apple' then '/assets/items/treats/energy_apple.png' when 'cookie' then '/assets/items/treats/crunchik.png' when 'berry' then '/assets/items/treats/glowing_berry.png' when 'icecream' then '/assets/items/treats/ice_dessert.png' else '/assets/items/treats/star_crystal.png' end into v_item_name, v_item_image;
    select inventory, exists(select 1 from jsonb_array_elements(coalesce(inventory, '[]'::jsonb)) x where x->>'id' = v_item_id) into v_inventory, v_has_item from public.profiles where id = v_uid for update;
    if v_has_item then
      select coalesce(jsonb_agg(case when x->>'id' = v_item_id then jsonb_set(x, '{quantity}', to_jsonb(coalesce((x->>'quantity')::integer, 0) + 1)) else x end), '[]'::jsonb) into v_inventory from jsonb_array_elements(coalesce(v_inventory, '[]'::jsonb)) x;
    else
      v_inventory := coalesce(v_inventory, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('id', v_item_id, 'type', 'food', 'name', v_item_name, 'quantity', 1, 'metadata', jsonb_build_object('imageUrl', v_item_image)));
    end if;
    update public.profiles set inventory = v_inventory, updated_at = now() where id = v_uid returning * into v_profile;
    update public.daily_quests set completed = true, completed_at = now(), reward_item_id = v_item_id where user_id = v_uid and quest_date = v_row.quest_date returning * into v_row;
    return jsonb_build_object('quest', public.get_daily_quest(), 'new_reward_item_id', v_item_id, 'profile', to_jsonb(v_profile));
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  return jsonb_build_object('quest', public.get_daily_quest(), 'new_reward_item_id', null, 'profile', to_jsonb(v_profile));
end;
$function$;