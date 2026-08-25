create or replace function public.bump_session_version_on_password_change()
returns trigger language plpgsql as $$
begin
  if new.password_hash is distinct from old.password_hash then
    new.session_version := old.session_version + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists app_users_bump_session_version on public.app_users;
create trigger app_users_bump_session_version
before update of password_hash on public.app_users
for each row execute function public.bump_session_version_on_password_change();

-- Old profile codes were reusable bearer-like values with no parent-controlled lifecycle.
-- Existing teacher links stay active, but every family must explicitly create a new
-- one-time invite before connecting another teacher.
update public.profiles
   set child_share_code = null,
       updated_at = now()
 where child_share_code is not null;
