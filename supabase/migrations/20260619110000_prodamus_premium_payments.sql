-- Prodamus one-time payments for AnnWord Premium.
-- This migration is safe to apply independently: it creates payment records and an
-- idempotent activation RPC used by the server-side webhook handler.

create extension if not exists pgcrypto;

create table if not exists public.premium_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'prodamus',
  provider_order_id text not null,
  provider_payment_id text,
  plan_code text not null,
  period_days integer not null,
  amount_rub integer not null,
  currency text not null default 'RUB',
  status text not null default 'pending',
  checkout_url text,
  customer_email text,
  paid_at timestamptz,
  premium_expires_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint premium_payments_provider_check check (provider in ('prodamus')),
  constraint premium_payments_plan_check check (plan_code in ('kids_month', 'kids_year')),
  constraint premium_payments_period_check check (period_days in (31, 365)),
  constraint premium_payments_amount_check check (amount_rub > 0),
  constraint premium_payments_status_check check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'ignored'))
);

create unique index if not exists premium_payments_provider_order_unique
  on public.premium_payments(provider, provider_order_id);

create index if not exists premium_payments_user_created_idx
  on public.premium_payments(user_id, created_at desc);

create or replace function public.touch_premium_payments_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists premium_payments_touch_updated_at on public.premium_payments;
create trigger premium_payments_touch_updated_at
before update on public.premium_payments
for each row execute function public.touch_premium_payments_updated_at();

create or replace function public.activate_paid_premium_payment(
  p_provider_order_id text,
  p_provider_payment_id text default null,
  p_raw_payload jsonb default '{}'::jsonb
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.premium_payments;
  v_profile public.profiles;
  v_base_expires timestamptz;
  v_next_expires timestamptz;
begin
  if nullif(trim(p_provider_order_id), '') is null then
    raise exception 'provider_order_id is required';
  end if;

  select * into v_payment
    from public.premium_payments
   where provider = 'prodamus'
     and provider_order_id = trim(p_provider_order_id)
   for update;

  if v_payment.id is null then
    raise exception 'Payment order not found';
  end if;

  select * into v_profile
    from public.profiles
   where id = v_payment.user_id
   for update;

  if v_profile.id is null then
    raise exception 'Payment profile not found';
  end if;

  -- Idempotency: a repeated webhook must not extend Premium twice.
  if v_payment.status = 'paid' then
    return v_profile;
  end if;

  v_base_expires := greatest(coalesce(v_profile.premium_expires_at, now()), now());
  v_next_expires := v_base_expires + make_interval(days => v_payment.period_days);

  update public.premium_payments
     set status = 'paid',
         provider_payment_id = coalesce(nullif(trim(p_provider_payment_id), ''), provider_payment_id),
         paid_at = now(),
         premium_expires_at = v_next_expires,
         raw_payload = coalesce(p_raw_payload, '{}'::jsonb)
   where id = v_payment.id;

  perform set_config('annword.rc_admin_write', 'allowed', true);

  update public.profiles
     set subscription_tier = 'premium',
         premium_expires_at = v_next_expires,
         feature_flags = jsonb_set(
           jsonb_set(coalesce(feature_flags, '{}'::jsonb), '{premiumDictionaries}', 'true'::jsonb, true),
           '{adultRoom}', 'true'::jsonb, true
         ),
         updated_at = now()
   where id = v_profile.id
   returning * into v_profile;

  return v_profile;
end;
$$;

revoke execute on function public.activate_paid_premium_payment(text, text, jsonb) from public, anon, authenticated;
notify pgrst, 'reload schema';
