-- FEATURE BRANCH ONLY: do not apply to production until reviewed.
-- Functions used by the parent report cron and daily streak/world reward flow.

create or replace function public.enqueue_weekly_parent_reports(p_week_start date default (current_date - 7))
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inserted integer;
begin
  insert into public.weekly_report_outbox(adult_user_id, learner_user_id, email, week_start, payload)
  select
    subscription.adult_user_id,
    subscription.learner_user_id,
    subscription.email,
    p_week_start,
    jsonb_build_object(
      'learner_name', learner.username,
      'week_label', to_char(p_week_start, 'DD.MM.YYYY') || '–' || to_char(p_week_start + 6, 'DD.MM.YYYY'),
      'games_played', coalesce((learner.stats->>'gamesPlayed')::integer, 0),
      'accuracy', case
        when coalesce((learner.stats->>'gamesPlayed')::integer, 0) = 0 then 0
        else round(coalesce((learner.stats->>'gamesWon')::numeric, 0) * 100 / greatest((learner.stats->>'gamesPlayed')::numeric, 1))
      end,
      'difficult_words', coalesce(
        (select jsonb_agg(entry.key order by (entry.value)::integer desc)
           from jsonb_each_text(coalesce(learner.stats->'wordsToReview', '{}'::jsonb)) entry
          where (entry.value)::integer > 0),
        '[]'::jsonb
      ),
      'learned_words', coalesce(
        (select jsonb_agg(entry.key order by (entry.value)::integer desc)
           from jsonb_each_text(coalesce(learner.stats->'wordsGuessed', '{}'::jsonb)) entry
          where (entry.value)::integer > 0),
        '[]'::jsonb
      )
    )
  from public.weekly_report_subscriptions subscription
  join public.profiles learner on learner.id = subscription.learner_user_id
  where subscription.enabled = true
    and subscription.weekday = extract(dow from current_date)::smallint
  on conflict (adult_user_id, learner_user_id, week_start) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace function public.apply_daily_streak_reward(p_user_id uuid, p_activity_date date default current_date)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet jsonb;
  v_last_date date;
  v_streak integer;
  v_stickers jsonb;
begin
  if auth.uid() is null or p_user_id <> auth.uid() then raise exception 'Unauthorized'; end if;

  select pet into v_pet from public.profiles where id = p_user_id for update;
  v_last_date := nullif(v_pet->>'lastDailyActivityDate', '')::date;
  v_streak := coalesce((v_pet->>'dailyStreak')::integer, 0);

  if v_last_date = p_activity_date then
    return v_pet;
  elsif v_last_date = p_activity_date - 1 then
    v_streak := v_streak + 1;
  else
    v_streak := 1;
  end if;

  v_stickers := coalesce(v_pet->'earnedStickerIds', '[]'::jsonb);
  if v_streak >= 3 and not (v_stickers ? 'streak_3') then v_stickers := v_stickers || '"streak_3"'::jsonb; end if;
  if v_streak >= 7 and not (v_stickers ? 'streak_7') then v_stickers := v_stickers || '"streak_7"'::jsonb; end if;
  if v_streak >= 14 and not (v_stickers ? 'streak_14') then v_stickers := v_stickers || '"streak_14"'::jsonb; end if;
  if v_streak >= 30 and not (v_stickers ? 'streak_30') then v_stickers := v_stickers || '"streak_30"'::jsonb; end if;

  v_pet := jsonb_set(v_pet, '{dailyStreak}', to_jsonb(v_streak), true);
  v_pet := jsonb_set(v_pet, '{lastDailyActivityDate}', to_jsonb(p_activity_date::text), true);
  v_pet := jsonb_set(v_pet, '{earnedStickerIds}', v_stickers, true);

  update public.profiles set pet = v_pet, updated_at = now() where id = p_user_id;
  return v_pet;
end;
$$;

-- Integrate by calling apply_daily_streak_reward(auth.uid()) when a player completes
-- the first game of a local day, and unlock_daily_world_reward after completing a daily quest.
