alter table public.profiles
  add column if not exists active_word_source jsonb not null
  default '{"source":"builtin","difficulty":"ALL"}'::jsonb;

update public.profiles
   set active_word_source = '{"source":"builtin","difficulty":"ALL"}'::jsonb
 where active_word_source is null
    or jsonb_typeof(active_word_source) <> 'object'
    or active_word_source->>'source' not in ('builtin', 'custom', 'premium');
