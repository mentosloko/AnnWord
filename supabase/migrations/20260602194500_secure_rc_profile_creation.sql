-- Prevent authenticated clients from self-assigning RC access during profile creation.

create or replace function public.protect_rc_access_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('annword.rc_admin_write', true), '') <> 'allowed' then
    if tg_op = 'INSERT' then
      new.role := 'user';
      new.subscription_tier := 'free';
      new.feature_flags := '{}'::jsonb;
    else
      new.role := old.role;
      new.subscription_tier := old.subscription_tier;
      new.feature_flags := old.feature_flags;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_rc_access_fields on public.profiles;
create trigger protect_rc_access_fields
before insert or update on public.profiles
for each row execute function public.protect_rc_access_fields();

notify pgrst, 'reload schema';
