-- Correct PR #147's first index version on environments where it may already exist.
-- The words array is intentionally not stored in the B-tree because assignments are unbounded.
drop index if exists public.assigned_word_sets_learner_active_cover_idx;

create index if not exists assigned_word_sets_learner_active_idx
  on public.assigned_word_sets(learner_user_id, created_at desc)
  where archived_at is null;

-- Admin performance analytics scans only recent request telemetry; keep that scan off the
-- general analytics timeline as the table grows.
create index if not exists analytics_events_performance_time_idx
  on public.analytics_events(occurred_at desc)
  where event_type = 'performance'
    and event_name in ('request_completed', 'request_failed');
