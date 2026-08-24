-- Hot-path index review (2026-08-24):
-- profiles.id and app_users.id are primary keys; app_users.email is unique;
-- daily_quests(user_id, quest_date) is the primary key;
-- game_events.event_key is unique and game_events_user_time_idx already covers user timelines;
-- analytics_events_user_time_idx already covers per-user analytics reads.
-- Keep the unbounded words array out of the B-tree: heap lookup is safer than risking
-- oversized index tuples for large teacher-assigned dictionaries.
create index if not exists assigned_word_sets_learner_active_idx
  on public.assigned_word_sets(learner_user_id, created_at desc)
  where archived_at is null;
