-- New player profiles start without coins.
-- This changes only the default for future inserts; existing balances are preserved.

alter table public.profiles
  alter column coins set default 0;

notify pgrst, 'reload schema';
