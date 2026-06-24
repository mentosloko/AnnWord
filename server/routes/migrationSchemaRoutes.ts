import { Router, type Request, type Response } from "express";
import { transaction } from "../db";

export const migrationSchemaRouter = Router();

const ddlStatements = [
  `alter table public.app_users drop constraint if exists app_users_provider_check`,
  `alter table public.app_users add constraint app_users_provider_check check (provider in ('email', 'yandex', 'supabase'))`,
  `alter table public.profiles add column if not exists child_display_name text`,
  `alter table public.profiles add column if not exists child_share_code text`,
  `alter table public.profiles add column if not exists parent_pin_hash text`,
  `alter table public.profiles add column if not exists child_slots_limit integer not null default 1`,
  `alter table public.profiles add column if not exists premium_expires_at timestamptz`,
  `alter table public.profiles add column if not exists weekly_report_email text`,
  `alter table public.profiles add column if not exists account_mode text not null default 'player'`,
  `alter table public.profiles drop constraint if exists profiles_account_mode_check`,
  `alter table public.profiles add constraint profiles_account_mode_check check (account_mode in ('player', 'parent', 'teacher'))`,
  `alter table public.profiles alter column custom_dictionary_en drop default`,
  `alter table public.profiles alter column inventory drop default`,
  `alter table public.profiles alter column dictionary_collections drop default`,
  `alter table public.profiles alter column custom_dictionary_en type text[] using case when custom_dictionary_en is null then array[]::text[] when jsonb_typeof(custom_dictionary_en::jsonb) = 'array' then array(select jsonb_array_elements_text(custom_dictionary_en::jsonb)) else array[]::text[] end`,
  `alter table public.profiles alter column inventory type text[] using case when inventory is null then array[]::text[] when jsonb_typeof(inventory::jsonb) = 'array' then array(select jsonb_array_elements_text(inventory::jsonb)) else array[]::text[] end`,
  `alter table public.profiles alter column dictionary_collections type text[] using case when dictionary_collections is null then array[]::text[] when jsonb_typeof(dictionary_collections::jsonb) = 'array' then array(select jsonb_array_elements_text(dictionary_collections::jsonb)) else array[]::text[] end`,
  `alter table public.profiles alter column custom_dictionary_en set default array[]::text[]`,
  `alter table public.profiles alter column inventory set default array[]::text[]`,
  `alter table public.profiles alter column dictionary_collections set default array[]::text[]`,
  `create table if not exists public.dictionary_collections (id uuid primary key, owner_user_id uuid not null references public.profiles(id) on delete cascade, title text not null, source text not null default 'manual', class_label text, theme text, words text[] not null, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), archived_at timestamptz)`,
  `create table if not exists public.adult_learner_links (adult_user_id uuid not null references public.profiles(id) on delete cascade, learner_user_id uuid not null references public.profiles(id) on delete cascade, relation_role text not null, class_label text, created_at timestamptz not null default now(), primary key (adult_user_id, learner_user_id))`,
  `create table if not exists public.assigned_word_sets (id uuid primary key, adult_user_id uuid not null references public.profiles(id) on delete cascade, learner_user_id uuid not null references public.profiles(id) on delete cascade, title text not null, class_label text, theme text, source text not null default 'manual', words text[] not null, created_at timestamptz not null default now(), archived_at timestamptz)`,
  `create table if not exists public.weekly_report_subscriptions (adult_user_id uuid not null references public.profiles(id) on delete cascade, learner_user_id uuid not null references public.profiles(id) on delete cascade, email text not null, enabled boolean not null default true, weekday smallint not null default 1, last_sent_at timestamptz, created_at timestamptz not null default now(), primary key (adult_user_id, learner_user_id))`,
  `create table if not exists public.weekly_report_outbox (id uuid primary key, adult_user_id uuid not null references public.profiles(id) on delete cascade, learner_user_id uuid not null references public.profiles(id) on delete cascade, email text not null, week_start date not null, payload jsonb not null, status text not null default 'pending', created_at timestamptz not null default now(), sent_at timestamptz)`,
  `create table if not exists public.premium_requests (id uuid primary key, user_id uuid not null references public.profiles(id) on delete cascade, email text, product_code text not null default 'annword_kids_premium_month', provider text not null default 'prodamus', provider_payment_id text, status text not null default 'pending', requested_at timestamptz not null default now(), paid_at timestamptz, activated_at timestamptz, premium_months smallint not null default 1, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`,
  `create table if not exists public.premium_payments (id uuid primary key, user_id uuid not null references public.profiles(id) on delete cascade, provider text not null default 'prodamus', provider_order_id text not null, provider_payment_id text, plan_code text not null, period_days integer not null, amount_rub integer not null, currency text not null default 'RUB', status text not null default 'pending', checkout_url text, customer_email text, paid_at timestamptz, premium_expires_at timestamptz, raw_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`,
  `create table if not exists public.prodamus_webhook_events (id uuid primary key, provider text not null default 'prodamus', provider_order_id text, provider_payment_id text, status text not null default 'received', signature_valid boolean, is_paid boolean, error text, raw_payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now())`,
  `create table if not exists public.daily_quests (user_id uuid not null references public.profiles(id) on delete cascade, quest_date date not null, kind text not null, progress jsonb not null default '{}'::jsonb, completed boolean not null default false, completed_at timestamptz, reward_item_id text, created_at timestamptz not null default now(), reward_world_id text, primary key (user_id, quest_date))`,
  `create table if not exists public.game_events (id uuid primary key, user_id uuid not null references public.profiles(id) on delete cascade, event_key text not null, event_type text not null, game_mode text, word text, result text, quest_date date, quest_kind text, coins_delta integer not null default 0, xp_delta integer not null default 0, payload jsonb not null default '{}'::jsonb, occurred_at timestamptz not null default now(), created_at timestamptz not null default now())`,
  `alter table public.daily_quests add column if not exists reward_world_id text`,
  `alter table public.dictionary_collections add column if not exists metadata jsonb not null default '{}'::jsonb`,
  `alter table public.game_events add column if not exists payload jsonb not null default '{}'::jsonb`
];

function isAuthorized(req: Request): boolean {
  const secret = process.env.ANNWORD_MIGRATION_SECRET || "";
  const header = req.headers["x-annword-migration-secret"];
  return Boolean(secret) && typeof header === "string" && header === secret;
}

migrationSchemaRouter.post("/prepare", async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const applied: string[] = [];
  try {
    await transaction(async (client) => {
      for (const statement of ddlStatements) {
        await client.query(statement);
        applied.push(statement.split(/\s+/).slice(0, 5).join(" "));
      }
    });
    res.json({ ok: true, appliedCount: applied.length, applied });
  } catch (error) {
    console.error("Yandex migration schema prepare failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Schema prepare failed", applied });
  }
});
