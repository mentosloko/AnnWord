-- Parent/kids profiles created before CEFR availability guards could persist
-- builtin A2-C2 selections even though the free kids dictionary only has a
-- stable translated A1 pool. Normalize those legacy selections so games do
-- not reopen with an empty dictionary after this release.
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
   and coalesce(active_word_source->>'difficulty', 'ALL') not in ('ALL', 'A1');
