-- Correct PR #147's first index version on environments where it may already exist.
-- The words array is intentionally not stored in the B-tree because assignments are unbounded.
drop index if exists public.assigned_word_sets_learner_active_cover_idx;

create index if not exists assigned_word_sets_learner_active_idx
  on public.assigned_word_sets(learner_user_id, created_at desc)
  where archived_at is null;
