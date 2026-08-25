alter table public.assigned_word_sets
  add column if not exists word_translations jsonb not null default '{}'::jsonb;
