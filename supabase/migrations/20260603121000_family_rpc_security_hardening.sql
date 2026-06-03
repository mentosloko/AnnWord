-- Keep family RPCs inaccessible to anonymous clients and align the dictionary guard
-- with the production-safe implementation used during rollout.

create or replace function public.protect_custom_dictionary_access()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null
     and new.custom_dictionary_en is distinct from old.custom_dictionary_en
     and coalesce(current_setting('annword.dictionary_write', true), '') <> 'allowed'
     and not public.has_active_premium(auth.uid())
     and not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin') then
    raise exception 'Premium required';
  end if;
  return new;
end;
$$;

revoke execute on function public.create_single_child_profile(text, text) from public, anon;
revoke execute on function public.verify_parent_pin(text) from public, anon;
revoke execute on function public.connect_teacher_to_child_by_code(text) from public, anon;
revoke execute on function public.get_managed_learner_word_stats() from public, anon;
revoke execute on function public.assign_dictionary_collection_to_learner(uuid, text) from public, anon;
revoke execute on function public.save_premium_dictionary_collection(text, text[], text, text, text) from public, anon;
revoke execute on function public.has_active_premium(uuid) from public, anon, authenticated;

grant execute on function public.create_single_child_profile(text, text) to authenticated;
grant execute on function public.verify_parent_pin(text) to authenticated;
grant execute on function public.connect_teacher_to_child_by_code(text) to authenticated;
grant execute on function public.get_managed_learner_word_stats() to authenticated;
grant execute on function public.assign_dictionary_collection_to_learner(uuid, text) to authenticated;
grant execute on function public.save_premium_dictionary_collection(text, text[], text, text, text) to authenticated;

notify pgrst, 'reload schema';
