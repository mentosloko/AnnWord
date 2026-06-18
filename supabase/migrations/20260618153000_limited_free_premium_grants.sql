-- Limited free Premium grants for trials and support cases.
-- Admins can grant Premium for a bounded number of days without creating a payment record.

create or replace function public.grant_free_premium_access(p_target_user_id uuid, p_days integer default 7)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
  v_days integer := least(greatest(coalesce(p_days, 7), 1), 365);
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'Admin role required';
  end if;

  perform set_config('annword.rc_admin_write', 'allowed', true);
  update public.profiles
     set subscription_tier = 'premium',
         premium_expires_at = now() + make_interval(days => v_days),
         feature_flags = jsonb_set(
           jsonb_set(coalesce(feature_flags, '{}'::jsonb), '{premiumDictionaries}', 'true'::jsonb, true),
           '{adultRoom}', 'true'::jsonb, true
         ),
         updated_at = now()
   where id = p_target_user_id
   returning * into v_profile;

  if v_profile.id is null then raise exception 'Profile not found'; end if;
  return v_profile;
end;
$$;

revoke execute on function public.grant_free_premium_access(uuid, integer) from public, anon;
grant execute on function public.grant_free_premium_access(uuid, integer) to authenticated;
notify pgrst, 'reload schema';
