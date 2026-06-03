-- New authenticated users choose their usage scenario once.
-- Legacy users keep their previous player or adult behavior.
alter table public.profiles add column if not exists account_mode text;
alter table public.profiles drop constraint if exists profiles_account_mode_check;
alter table public.profiles add constraint profiles_account_mode_check check (account_mode is null or account_mode in ('player','parent','teacher'));

update public.profiles
set account_mode = case
  when role = 'parent' then 'parent'
  when role = 'teacher' then 'teacher'
  when role in ('user','admin') then 'player'
  else account_mode end
where account_mode is null and created_at < timestamptz '2026-06-03 19:15:00+00';
update public.profiles set account_mode = 'parent' where role = 'parent' and account_mode is null;
update public.profiles set account_mode = 'teacher' where role = 'teacher' and account_mode is null;

create or replace function public.select_account_mode(p_mode text)
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_mode not in ('player','parent','teacher') then raise exception 'Invalid account mode'; end if;
  if exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then raise exception 'Admin mode is managed separately'; end if;
  perform set_config('annword.rc_admin_write', 'allowed', true);
  update public.profiles
     set account_mode = p_mode,
         role = case when p_mode = 'parent' then 'parent' when p_mode = 'teacher' then 'teacher' else 'user' end,
         feature_flags = case when p_mode in ('parent','teacher')
           then jsonb_set(coalesce(feature_flags, '{}'::jsonb), '{adultRoom}', 'true'::jsonb, true)
           else coalesce(feature_flags, '{}'::jsonb) end
   where id = auth.uid() and account_mode is null;
  if not found then raise exception 'Account mode already selected'; end if;
  return p_mode;
end;
$$;

revoke execute on function public.select_account_mode(text) from public, anon;
grant execute on function public.select_account_mode(text) to authenticated;
notify pgrst, 'reload schema';
