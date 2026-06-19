create table if not exists public.prodamus_webhook_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'prodamus',
  provider_order_id text,
  provider_payment_id text,
  status text not null default 'received',
  signature_valid boolean,
  is_paid boolean,
  error text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.prodamus_webhook_events enable row level security;

revoke all on public.prodamus_webhook_events from anon, authenticated;

create index if not exists prodamus_webhook_events_order_idx
  on public.prodamus_webhook_events (provider_order_id, created_at desc);

create index if not exists prodamus_webhook_events_created_idx
  on public.prodamus_webhook_events (created_at desc);
