-- Core RPC contract used by the frontend after the cloud migration.
-- These functions make a fresh environment reproducible from migrations.

create table if not exists public.game_event_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null unique,
  event_type text not null,
  game_mode text,
  word text,
  result text,
  quest_date date,
  quest_kind text,
  coins_delta integer not null default 0,
  xp_delta integer not null default 0,
  payload jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists game_event_ledger_user_created_idx on public.game_event_ledger(user_id, created_at desc);

alter table public.game_event_ledger enable row level security;

drop policy if exists game_event_ledger_select_own on public.game_event_ledger;
create policy game_event_ledger_select_own on public.game_event_ledger
  for select using (auth.uid() = user_id);

create or replace function public.record_game_events(p_events jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare v_event jsonb; v_user uuid;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_events is null or jsonb_typeof(p_events) <> 'array' then return; end if;
  for v_event in select value from jsonb_array_elements(p_events) loop
    v_user := nullif(v_event->>'userId', '')::uuid;
    if v_user is null or v_user <> auth.uid() then raise exception 'Forbidden'; end if;
    insert into public.game_event_ledger(user_id, event_key, event_type, game_mode, word, result, quest_date, quest_kind, coins_delta, xp_delta, payload, occurred_at)
    values (
      v_user,
      coalesce(nullif(v_event->>'eventKey', ''), gen_random_uuid()::text),
      coalesce(nullif(v_event->>'eventType', ''), 'unknown'),
      nullif(v_event->>'gameMode', ''),
      nullif(v_event->>'word', ''),
      nullif(v_event->>'result', ''),
      nullif(v_event->>'questDate', '')::date,
      nullif(v_event->>'questKind', ''),
      coalesce((v_event->>'coinsDelta')::integer, 0),
      coalesce((v_event->>'xpDelta')::integer, 0),
      coalesce(v_event->'payload', '{}'::jsonb),
      coalesce(nullif(v_event->>'occurredAt', '')::timestamptz, now())
    )
    on conflict (event_key) do nothing;
  end loop;
end;
$$;

create or replace function public.apply_game_result(
  p_user_id uuid,
  p_stats jsonb,
  p_pet jsonb,
  p_coins_delta integer default 0,
  p_analytics_events jsonb default '[]'::jsonb,
  p_game_events jsonb default '[]'::jsonb
)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_user_id <> auth.uid() then raise exception 'Forbidden'; end if;
  update public.profiles
     set stats = coalesce(p_stats, stats),
         pet = coalesce(p_pet, pet),
         coins = greatest(0, coalesce(coins, 0) + coalesce(p_coins_delta, 0)),
         updated_at = now()
   where id = p_user_id
   returning * into v_profile;
  if v_profile.id is null then raise exception 'Profile not found'; end if;
  perform public.record_game_events(coalesce(p_game_events, '[]'::jsonb));
  return v_profile;
end;
$$;

create or replace function public.sync_profile_state(
  p_user_id uuid,
  p_inventory jsonb,
  p_pet jsonb,
  p_coins integer,
  p_analytics_events jsonb default '[]'::jsonb
)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_user_id <> auth.uid() then raise exception 'Forbidden'; end if;
  update public.profiles
     set inventory = coalesce(p_inventory, inventory),
         pet = coalesce(p_pet, pet),
         coins = greatest(0, coalesce(p_coins, coins, 0)),
         updated_at = now()
   where id = p_user_id
   returning * into v_profile;
  if v_profile.id is null then raise exception 'Profile not found'; end if;
  return v_profile;
end;
$$;

create or replace function public.purchase_shop_item(p_user_id uuid, p_item jsonb)
returns public.profiles language plpgsql security definer set search_path = public as $$
declare v_profile public.profiles; v_price integer; v_item_id text; v_inventory jsonb;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  if p_user_id <> auth.uid() then raise exception 'Forbidden'; end if;
  v_price := greatest(0, coalesce((p_item->>'price')::integer, 0));
  v_item_id := nullif(p_item->>'id', '');
  if v_item_id is null then raise exception 'Invalid item'; end if;
  select * into v_profile from public.profiles where id = p_user_id for update;
  if v_profile.id is null then raise exception 'Profile not found'; end if;
  if coalesce(v_profile.coins, 0) < v_price then raise exception 'Недостаточно монет.'; end if;
  v_inventory := coalesce(v_profile.inventory, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'id', v_item_id,
    'type', coalesce(nullif(p_item->>'type', ''), 'food'),
    'name', coalesce(nullif(p_item->>'name', ''), v_item_id),
    'quantity', 1,
    'metadata', jsonb_build_object('imageUrl', coalesce(p_item->>'imageUrl', ''))
  ));
  update public.profiles
     set coins = coalesce(coins, 0) - v_price,
         inventory = v_inventory,
         updated_at = now()
   where id = p_user_id
   returning * into v_profile;
  return v_profile;
end;
$$;

revoke execute on function public.record_game_events(jsonb) from public, anon;
revoke execute on function public.apply_game_result(uuid, jsonb, jsonb, integer, jsonb, jsonb) from public, anon;
revoke execute on function public.sync_profile_state(uuid, jsonb, jsonb, integer, jsonb) from public, anon;
revoke execute on function public.purchase_shop_item(uuid, jsonb) from public, anon;
grant execute on function public.record_game_events(jsonb) to authenticated;
grant execute on function public.apply_game_result(uuid, jsonb, jsonb, integer, jsonb, jsonb) to authenticated;
grant execute on function public.sync_profile_state(uuid, jsonb, jsonb, integer, jsonb) to authenticated;
grant execute on function public.purchase_shop_item(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';