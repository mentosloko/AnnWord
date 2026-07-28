-- Daily Kids rewards: backgrounds should be more common than treats.
-- The result is deterministic for a user and date so retries cannot change it.

create or replace function public.apply_daily_quest_result(p_game_type text, p_result jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_day date := (timezone('Europe/London', now()))::date;
  v_result jsonb;
  v_item text;
  v_world text;
  v_reward_roll integer;
  v_profile public.profiles;
begin
  if v_uid is null then raise exception 'Unauthorized'; end if;

  v_result := public.apply_daily_quest_result_treat_reward(p_game_type, p_result);
  v_item := v_result->>'new_reward_item_id';
  if v_item is null then return v_result; end if;

  if public.rc_feature_enabled(v_uid, 'streakStickers') then
    perform public.apply_rc_daily_streak(v_uid, v_day);
  end if;

  -- 0–6 => background (70%), 7–9 => treat (30%).
  v_reward_roll := mod(
    abs(hashtextextended(v_uid::text || ':' || v_day::text || ':daily-reward-v2', 0))::numeric,
    10
  )::integer;

  if v_reward_roll >= 7 then
    select * into v_profile from public.profiles where id = v_uid;
    return jsonb_set(v_result, '{profile}', to_jsonb(v_profile), true);
  end if;

  v_world := (array['theatre','amusement_park','ice_rink','opera','sausage_fridge'])[
    1 + mod(
      abs(hashtextextended(v_uid::text || ':' || v_day::text || ':daily-world-v2', 0))::numeric,
      5
    )::integer
  ];

  perform public.remove_rc_inventory_reward(v_uid, v_item);

  update public.profiles
     set pet = jsonb_set(
       jsonb_set(pet, '{activeWorldId}', to_jsonb(v_world), true),
       '{activeWorldDate}', to_jsonb(v_day::text), true
     ),
     updated_at = now()
   where id = v_uid
   returning * into v_profile;

  update public.daily_quests
     set reward_item_id = null,
         reward_world_id = v_world,
         updated_at = now()
   where user_id = v_uid
     and quest_date = v_day;

  return jsonb_build_object(
    'quest', public.get_daily_quest(),
    'new_reward_item_id', null,
    'new_reward_world_id', v_world,
    'profile', to_jsonb(v_profile)
  );
end;
$$;

grant execute on function public.apply_daily_quest_result(text, jsonb) to authenticated;
notify pgrst, 'reload schema';
