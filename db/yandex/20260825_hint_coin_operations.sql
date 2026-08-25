create table if not exists public.hint_coin_operations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  operation_id text not null,
  cost integer not null default 1 check (cost > 0),
  status text not null check (status in ('charged', 'refunded')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, operation_id)
);

create index if not exists hint_coin_operations_updated_at_idx
  on public.hint_coin_operations(updated_at);
