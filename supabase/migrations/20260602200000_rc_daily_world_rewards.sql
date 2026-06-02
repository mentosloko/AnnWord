-- Replace a newly awarded daily treat with a one-day background only for enabled RC profiles.
-- Existing users keep the treat reward while their dailyWorldReward feature flag is disabled.

create or replace function public.apply_rc_daily_streak(p_user_id uuid, p_day date)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_pet jsonb; v_last date; v_days integer; v_stickers jsonb;
begin
  select pet into v_pet from public.profiles where id = p_user_id for update;
  v_last := nullif(v_pet->>'lastDailyActivityDate', '')::date;
  v_days := coalesce((v_pet->>'dailyStreak')::integer, 0);
  if v_last = p_day then return v_pet; end if;
  if v_last = p_day - 1 then v_days := v_days + 1; else v_days := 1; end if;
  v_stickers := coalesce(v_pet->'earnedStickerIds', '[]'::jsonb);
  if v_days >= 3 and not (v_stickers ? 'streak_3') then v_stickers := v_stickers || to_jsonb('streak_3'::text); end if;
  if v_days >= 7 and not (v_stickers ? 'streak_7') then v_stickers := v_stickers || to_jsonb('streak_7'::text); end if;
  if v_days >= 14 and not (v_stickers ? 'streak_14') then v_stickers := v_stickers || to_jsonb('streak_14'::text); end if;
  if v_days >= 30 and not (v_stickers ? 'streak_30') then v_stickers := v_stickers || to_jsonb('streak_30'::text); end if;
  v_pet := jsonb_set(jsonb_set(jsonb_set(v_pet, '{dailyStreak}', to_jsonb(v_days), true), '{lastDailyActivityDate}', to_jsonb(p_day::text), true), '{earnedStickerIds}', v_stickers, true);
  update public.profiles set pet = v_pet where id = p_user_id;
  return v_pet;
end;
$$;
revoke all on function public.apply_rc_daily_streak(uuid, date) from public, authenticated;

create or replace function public.remove_rc_inventory_reward(p_user_id uuid, p_item_id text)
returns void language plpgsql security definer set search_path = public as $$
declare v_inventory jsonb;
begin
  select coalesce(inventory, '[]'::jsonb) into v_inventory from public.profiles where id = p_user_id for update;
  select coalesce(jsonb_agg(case when x->>'id' = p_item_id and coalesce((x->>'quantity')::integer, 1) > 1 then jsonb_set(x, '{quantity}', to_jsonb((x->>'quantity')::integer - 1)) else x end) filter (where x->>'id' <> p_item_id or coalesce((x->>'quantity')::integer, 1) > 1), '[]'::jsonb)
    into v_inventory from jsonb_array_elements(v_inventory) x;
  update public.profiles set inventory = v_inventory where id = p_user_id;
end;
$$;
revoke all on function public.remove_rc_inventory_reward(uuid, text) from public, authenticated;

do $$
begin
  if to_regprocedure('public.apply_daily_quest_result_treat_reward(text,jsonb)') is null then
    alter function public.apply_daily_quest_result(text, jsonb) rename to apply_daily_quest_result_treat_reward;
  end if;
end;
$$;
revoke all on function public.apply_daily_quest_result_treat_reward(text, jsonb) from public, authenticated;

create or replace function public.get_daily_quest()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_row public.daily_quests;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  v_row := public.ensure_daily_quest(auth.uid());
  return jsonb_build_object('quest_date', v_row.quest_date, 'kind', v_row.kind, 'variant_key', coalesce(v_row.progress->>'variant_key', v_row.kind), 'completed', v_row.completed, 'completed_at', v_row.completed_at, 'reward_item_id', v_row.reward_item_id, 'reward_world_id', v_row.reward_world_id, 'completed_modes', coalesce(v_row.progress->'completed_modes', '[]'::jsonb), 'progress', v_row.progress);
end;
$$;

create or replace function public.apply_daily_quest_result(p_game_type text, p_result jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_day date := (timezone('Europe/London', now()))::date; v_result jsonb; v_item text; v_world text; v_profile public.profiles;
begin
  if v_uid is null then raise exception 'Unauthorized'; end if;
  v_result := public.apply_daily_quest_result_treat_reward(p_game_type, p_result);
  v_item := v_result->>'new_reward_item_id';
  if v_item is null then return v_result; end if;
  if public.rc_feature_enabled(v_uid, 'streakStickers') then perform public.apply_rc_daily_streak(v_uid, v_day); end if;
  if not public.rc_feature_enabled(v_uid, 'dailyWorldReward') then
    select * into v_profile from public.profiles where id = v_uid;
    return jsonb_set(v_result, '{profile}', to_jsonb(v_profile), true);
  end if;
  v_world := (array['theatre','amusement_park','ice_rink','opera','sausage_fridge'])[1 + mod(abs(hashtextextended(v_uid::text || ':' || v_day::text || ':daily-world', 0))::numeric, 5)::int];
  perform public.remove_rc_inventory_reward(v_uid, v_item);
  update public.profiles set pet = jsonb_set(jsonb_set(pet, '{activeWorldId}', to_jsonb(v_world), true), '{activeWorldDate}', to_jsonb(v_day::text), true) where id = v_uid returning * into v_profile;
  update public.daily_quests set reward_item_id = null, reward_world_id = v_world where user_id = v_uid and quest_date = v_day;
  return jsonb_build_object('quest', public.get_daily_quest(), 'new_reward_item_id', null, 'new_reward_world_id', v_world, 'profile', to_jsonb(v_profile));
end;
$$;
grant execute on function public.get_daily_quest() to authenticated;
grant execute on function public.apply_daily_quest_result(text, jsonb) to authenticated;
notify pgrst, 'reload schema';
