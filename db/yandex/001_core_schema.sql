create table if not exists public.app_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  full_name text,
  provider text not null default 'email' check (provider in ('email', 'yandex')),
  yandex_id text unique,
  email_confirmed_at timestamptz,
  password_reset_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references public.app_users(id) on delete cascade,
  username text not null,
  role text not null default 'user' check (role in ('admin', 'user', 'parent', 'teacher')),
  account_mode text check (account_mode is null or account_mode in ('player', 'parent', 'teacher')),
  subscription_tier text not null default 'free' check (subscription_tier in ('free', 'premium')),
  premium_expires_at timestamptz,
  feature_flags jsonb not null default '{}'::jsonb,
  dictionary_collections jsonb not null default '[]'::jsonb,
  weekly_report_email text,
  child_display_name text,
  child_share_code text unique,
  child_slots_limit integer not null default 1 check (child_slots_limit >= 1),
  custom_dictionary_en jsonb not null default '[]'::jsonb,
  stats jsonb not null default '{"gamesPlayed":0,"gamesWon":0,"wordsGuessed":{},"wordsToReview":{},"wordPerformance":{}}'::jsonb,
  pet jsonb not null default '{"name":"Щенок","type":"Puppy","level":1,"mood":"happy","xp":0,"moodScore":60,"hunger":60,"energy":60,"equippedAccessories":[]}'::jsonb,
  coins integer not null default 0 check (coins >= 0),
  inventory jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.adult_learner_links (
  adult_user_id uuid not null references public.profiles(id) on delete cascade,
  learner_user_id uuid not null references public.profiles(id) on delete cascade,
  relation_role text not null check (relation_role in ('parent', 'teacher')),
  class_label text,
  created_at timestamptz not null default now(),
  primary key (adult_user_id, learner_user_id),
  check (adult_user_id <> learner_user_id)
);

create table if not exists public.assigned_word_sets (
  id uuid primary key default gen_random_uuid(),
  adult_user_id uuid not null references public.profiles(id) on delete cascade,
  learner_user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  class_label text,
  theme text,
  source text not null default 'manual' check (source in ('manual', 'ocr', 'class', 'topic')),
  words text[] not null default '{}',
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint assigned_word_sets_non_empty check (cardinality(words) > 0)
);

create table if not exists public.premium_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null default 'prodamus' check (provider in ('prodamus')),
  provider_order_id text not null,
  provider_payment_id text,
  plan_code text not null check (plan_code in ('kids_month', 'kids_year')),
  period_days integer not null check (period_days in (31, 365)),
  amount_rub integer not null check (amount_rub > 0),
  currency text not null default 'RUB',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'ignored')),
  checkout_url text,
  customer_email text,
  paid_at timestamptz,
  premium_expires_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists premium_payments_provider_order_unique
  on public.premium_payments(provider, provider_order_id);
create index if not exists premium_payments_user_created_idx
  on public.premium_payments(user_id, created_at desc);
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists app_users_email_idx on public.app_users(lower(email));

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_users_set_updated_at on public.app_users;
create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists premium_payments_set_updated_at on public.premium_payments;
create trigger premium_payments_set_updated_at
before update on public.premium_payments
for each row execute function public.set_updated_at();

create or replace function public.increment_coins(p_user_id uuid, p_amount integer)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles;
begin
  update public.profiles
     set coins = greatest(0, coins + coalesce(p_amount, 0)),
         updated_at = now()
   where id = p_user_id
   returning * into v_profile;

  if v_profile.id is null then
    raise exception 'Profile not found';
  end if;

  return v_profile;
end;
$$;

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

  if v_payment.status = 'paid' then
    return v_profile;
  end if;

  v_base_expires := greatest(coalesce(v_profile.premium_expires_at, now()), now());
  v_next_expires := v_base_expires + make_interval(days => v_payment.period_days);

  update public.premium_payments
     set status = 'paid',
         provider_payment_id = coalesce(nullif(trim(p_provider_payment_id, '')), provider_payment_id),
         paid_at = now(),
         premium_expires_at = v_next_expires,
         raw_payload = coalesce(p_raw_payload, '{}'::jsonb)
   where id = v_payment.id;

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
