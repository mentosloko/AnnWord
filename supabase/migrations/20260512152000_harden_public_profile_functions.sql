create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    case when new.email = 'mentosloko@gmail.com' then 'admin' else 'user' end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon, authenticated;

revoke execute on function public.increment_coins(uuid, integer) from public;
revoke execute on function public.increment_coins(uuid, integer) from anon;
grant execute on function public.increment_coins(uuid, integer) to authenticated;

revoke execute on function public.set_updated_at() from public;
revoke execute on function public.set_updated_at() from anon, authenticated;

notify pgrst, 'reload schema';
