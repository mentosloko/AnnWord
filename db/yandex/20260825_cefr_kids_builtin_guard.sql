-- Parent/kids profiles created before CEFR availability guards could persist
-- builtin A2-C2 selections even though the free kids dictionary only has a
-- stable translated A1 pool. Normalize those legacy selections so games do
-- not reopen with an empty dictionary after this release.
--
-- The guard is intentionally schema-aware: benchmark/clean databases can run
-- migration files against a minimal schema before the active-word-source
-- columns are introduced. Production databases that already have the columns
-- still execute the normalization normally.
do $$
begin
  if exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'active_word_source'
  ) and exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'active_word_source_updated_at'
  ) and exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles' and column_name = 'account_mode'
  ) then
    execute $sql$
      update profiles
         set active_word_source = jsonb_set(
               coalesce(active_word_source, '{"source":"builtin","difficulty":"ALL"}'::jsonb),
               '{difficulty}',
               '"ALL"'::jsonb,
               true
             ),
             active_word_source_updated_at = now(),
             updated_at = now()
       where account_mode = 'parent'
         and coalesce(active_word_source->>'source', 'builtin') = 'builtin'
         and coalesce(active_word_source->>'difficulty', 'ALL') not in ('ALL', 'A1')
    $sql$;
  end if;
end
$$;
