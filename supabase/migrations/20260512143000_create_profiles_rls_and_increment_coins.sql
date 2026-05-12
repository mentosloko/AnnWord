create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text,
  role text default 'user',
  custom_dictionary_en jsonb default '[]'::jsonb,
  stats jsonb default '{"gamesPlayed":0,"gamesWon":0,"wordsGuessed":{}}'::jsonb,
  pet jsonb default '{"name":"Owl","type":"Owl","level":1,"mood":"happy","xp":0,"hunger":100,"energy":100,"equippedAccessories":[]}'::jsonb,
  updated_at timestamptz default now(),
  coins integer default 100,
  inventory jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

alter table public.profiles
  alter column username set not null,
  alter column role set not null,
  alter column role set default 'user',
  alter column custom_dictionary_en set default '[]'::jsonb,
  alter column custom_dictionary_en set not null,
  alter column stats set default '{"gamesPlayed":0,"gamesWon":0,"wordsGuessed":{}}'::jsonb,
  alter column stats set not null,
  alter column pet set default '{"name":"Owl","type":"Owl","level":1,"mood":"happy","xp":0,"hunger":100,"energy":100,"equippedAccessories":[]}'::jsonb,
  alter column pet set not null,
  alter column coins set default 100,
  alter column coins set not null,
  alter column inventory set default '[]'::jsonb,
  alter column inventory set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null,
  alter column created_at set default now(),
  alter column created_at set not null;

alter table public.profiles
  drop constraint if exists profiles_role_check,
  add constraint profiles_role_check check (role in ('admin', 'user'));

alter table public.profiles
  drop constraint if exists profiles_coins_check,
  add constraint profiles_coins_check check (coins >= 0);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile" on public.profiles;
create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop function if exists public.increment_coins(integer, uuid);

create or replace function public.increment_coins(user_id uuid, amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if user_id <> (select auth.uid()) then
    raise exception 'Not allowed to update coins for another user';
  end if;

  update public.profiles
  set coins = greatest(0, coins + amount)
  where id = user_id;
end;
$$;

grant execute on function public.increment_coins(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
