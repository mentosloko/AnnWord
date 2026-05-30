create or replace function public.get_admin_custom_dictionaries()
returns table (
  user_id uuid,
  username text,
  custom_dictionary_en jsonb
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.username, p.custom_dictionary_en
  from public.profiles p
  where exists (
    select 1
    from public.profiles admin_profile
    where admin_profile.id = auth.uid()
      and admin_profile.role = 'admin'
  )
    and jsonb_typeof(p.custom_dictionary_en) = 'array'
    and jsonb_array_length(p.custom_dictionary_en) > 0;
$$;

revoke all on function public.get_admin_custom_dictionaries() from public;
revoke all on function public.get_admin_custom_dictionaries() from anon;
grant execute on function public.get_admin_custom_dictionaries() to authenticated;
