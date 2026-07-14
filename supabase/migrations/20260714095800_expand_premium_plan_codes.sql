-- Keep payment plan codes aligned across Kids and Practice checkout flows.
-- Existing installations may have an unnamed or differently named CHECK constraint,
-- so remove only CHECK constraints whose definition references plan_code.

do $$
declare
  constraint_row record;
begin
  if to_regclass('public.premium_payments') is null then
    return;
  end if;

  for constraint_row in
    select conname
      from pg_constraint
     where conrelid = 'public.premium_payments'::regclass
       and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%plan_code%'
  loop
    execute format('alter table public.premium_payments drop constraint %I', constraint_row.conname);
  end loop;

  alter table public.premium_payments
    add constraint premium_payments_plan_code_check
    check (plan_code in ('kids_month', 'kids_year', 'practice_month', 'practice_year'));
end
$$;

notify pgrst, 'reload schema';
