-- Hot-path index review (2026-08-24):
-- profiles.id and app_users.id are primary keys; app_users.email is unique;
-- daily_quests(user_id, quest_date) is the primary key;
-- game_events.event_key is unique and game_events_user_time_idx already covers user timelines;
-- analytics_events_user_time_idx already covers per-user analytics reads.
-- The remaining hot hydration lookup benefits from an index-only path that includes words.
create index if not exists assigned_word_sets_learner_active_cover_idx
  on public.assigned_word_sets(learner_user_id, created_at desc)
  include (words)
  where archived_at is null;
