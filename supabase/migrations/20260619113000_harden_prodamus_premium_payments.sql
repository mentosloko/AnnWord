alter table public.premium_payments enable row level security;

create or replace function public.touch_premium_payments_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

notify pgrst, 'reload schema';
