import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { Router, type Request, type Response } from "express";
import { transaction } from "../db";

export const migrationRouter = Router();

type TablePlan = {
  name: string;
  columns: string[];
  conflictColumns: string[];
  requiresKnownUsers?: string[];
  optionalUserColumns?: string[];
  enabled?: (options: MigrationOptions) => boolean;
};

type MigrationOptions = {
  apply: boolean;
  includeGameEvents: boolean;
  includeAnalytics: boolean;
};

const plans: TablePlan[] = [
  {
    name: "profiles",
    columns: [
      "id", "username", "role", "custom_dictionary_en", "stats", "pet", "updated_at", "coins", "inventory", "created_at",
      "subscription_tier", "feature_flags", "dictionary_collections", "child_display_name", "child_share_code", "parent_pin_hash",
      "child_slots_limit", "premium_expires_at", "weekly_report_email", "account_mode",
    ],
    conflictColumns: ["id"],
    requiresKnownUsers: ["id"],
  },
  { name: "dictionary_collections", columns: ["id", "owner_user_id", "title", "source", "class_label", "theme", "words", "metadata", "created_at", "updated_at", "archived_at"], conflictColumns: ["id"], requiresKnownUsers: ["owner_user_id"] },
  { name: "adult_learner_links", columns: ["adult_user_id", "learner_user_id", "relation_role", "class_label", "created_at"], conflictColumns: ["adult_user_id", "learner_user_id"], requiresKnownUsers: ["adult_user_id", "learner_user_id"] },
  { name: "assigned_word_sets", columns: ["id", "adult_user_id", "learner_user_id", "title", "class_label", "theme", "source", "words", "created_at", "archived_at"], conflictColumns: ["id"], requiresKnownUsers: ["adult_user_id", "learner_user_id"] },
  { name: "weekly_report_subscriptions", columns: ["adult_user_id", "learner_user_id", "email", "enabled", "weekday", "last_sent_at", "created_at"], conflictColumns: ["adult_user_id", "learner_user_id"], requiresKnownUsers: ["adult_user_id", "learner_user_id"] },
  { name: "weekly_report_outbox", columns: ["id", "adult_user_id", "learner_user_id", "email", "week_start", "payload", "status", "created_at", "sent_at"], conflictColumns: ["id"], requiresKnownUsers: ["adult_user_id", "learner_user_id"] },
  { name: "premium_requests", columns: ["id", "user_id", "email", "product_code", "provider", "provider_payment_id", "status", "requested_at", "paid_at", "activated_at", "premium_months", "metadata", "created_at", "updated_at"], conflictColumns: ["id"], requiresKnownUsers: ["user_id"] },
  { name: "premium_payments", columns: ["id", "user_id", "provider", "provider_order_id", "provider_payment_id", "plan_code", "period_days", "amount_rub", "currency", "status", "checkout_url", "customer_email", "paid_at", "premium_expires_at", "raw_payload", "created_at", "updated_at"], conflictColumns: ["id"], requiresKnownUsers: ["user_id"] },
  { name: "prodamus_webhook_events", columns: ["id", "provider", "provider_order_id", "provider_payment_id", "status", "signature_valid", "is_paid", "error", "raw_payload", "created_at"], conflictColumns: ["id"] },
  { name: "daily_quests", columns: ["user_id", "quest_date", "kind", "progress", "completed", "completed_at", "reward_item_id", "created_at", "reward_world_id"], conflictColumns: ["user_id", "quest_date"], requiresKnownUsers: ["user_id"] },
  { name: "game_events", columns: ["id", "user_id", "event_key", "event_type", "game_mode", "word", "result", "quest_date", "quest_kind", "coins_delta", "xp_delta", "payload", "occurred_at", "created_at"], conflictColumns: ["id"], requiresKnownUsers: ["user_id"], enabled: (options) => options.includeGameEvents },
  { name: "analytics_events", columns: ["id", "user_id", "session_id", "event_type", "event_name", "game_type", "route", "occurred_at", "payload", "app_version", "user_agent", "device_type", "created_at"], conflictColumns: ["id"], optionalUserColumns: ["user_id"], enabled: (options) => options.includeAnalytics },
];

function readSourceUrl(): string {
  const value = process.env.SUPABASE_DATABASE_URL || process.env.SOURCE_DATABASE_URL || "";
  if (!value.trim()) throw new Error("SUPABASE_DATABASE_URL is not configured in backend environment.");
  return value.trim();
}

function sourcePool(): Pool {
  return new Pool({ connectionString: readSourceUrl(), ssl: { rejectUnauthorized: false }, max: 2, connectionTimeoutMillis: 10_000 });
}

function qi(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function placeholders(rows: number, columns: number): string {
  const groups: string[] = [];
  let n = 1;
  for (let r = 0; r < rows; r += 1) {
    const parts: string[] = [];
    for (let c = 0; c < columns; c += 1) parts.push(`$${n++}`);
    groups.push(`(${parts.join(", ")})`);
  }
  return groups.join(", ");
}

async function countRows(client: Pool | PoolClient, tableName: string): Promise<number> {
  const result = await client.query<{ count: string }>(`select count(*)::text as count from public.${qi(tableName)}`);
  return Number.parseInt(result.rows[0]?.count || "0", 10);
}

async function knownTargetUsers(client: PoolClient): Promise<Set<string>> {
  const result = await client.query<{ id: string }>("select id from public.app_users");
  return new Set(result.rows.map((row) => row.id));
}

async function targetEmailMap(client: PoolClient): Promise<Map<string, string>> {
  const result = await client.query<{ id: string; email: string }>("select id, lower(email) as email from public.app_users");
  return new Map(result.rows.map((row) => [row.email, row.id]));
}

function disabledCredentialHash(userId: string): string {
  return `migration-disabled-${userId}`;
}

async function migrateUsers(source: Pool, target: PoolClient, apply: boolean) {
  const result = await source.query<{
    id: string;
    email: string | null;
    full_name: string | null;
    email_confirmed_at: Date | null;
    created_at: Date | null;
    updated_at: Date | null;
  }>(`
    select
      id,
      lower(email) as email,
      coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)) as full_name,
      coalesce(email_confirmed_at, confirmed_at) as email_confirmed_at,
      created_at,
      updated_at
    from auth.users
    where email is not null
      and deleted_at is null
    order by created_at nulls last, id
  `);
  const emails = await targetEmailMap(target);
  const rows: unknown[][] = [];
  let skipped = 0;
  for (const user of result.rows) {
    const email = user.email?.trim().toLowerCase();
    if (!email) { skipped += 1; continue; }
    const existingId = emails.get(email);
    if (existingId && existingId !== user.id) { skipped += 1; continue; }
    rows.push([
      user.id,
      email,
      disabledCredentialHash(user.id),
      user.full_name || email.split("@")[0] || "Пользователь",
      "supabase",
      user.email_confirmed_at || user.created_at || new Date(),
      true,
      user.created_at || new Date(),
      user.updated_at || new Date(),
    ]);
  }
  if (!apply || !rows.length) return { table: "auth.users -> app_users", source: result.rows.length, selected: rows.length, written: 0, skipped };
  const columns = ["id", "email", "password_hash", "full_name", "provider", "email_confirmed_at", "password_reset_required", "created_at", "updated_at"];
  await target.query(
    `insert into public.app_users (${columns.map(qi).join(", ")}) values ${placeholders(rows.length, columns.length)}
     on conflict (id) do update set
       email = excluded.email,
       full_name = excluded.full_name,
       provider = excluded.provider,
       email_confirmed_at = coalesce(public.app_users.email_confirmed_at, excluded.email_confirmed_at),
       password_reset_required = true,
       updated_at = now()`,
    rows.flat(),
  );
  return { table: "auth.users -> app_users", source: result.rows.length, selected: rows.length, written: rows.length, skipped };
}

function rowAllowed(row: QueryResultRow, plan: TablePlan, users: Set<string>): boolean {
  for (const column of plan.requiresKnownUsers || []) {
    const value = row[column];
    if (value && !users.has(String(value))) return false;
  }
  return true;
}

function normalizeOptionalUsers(row: QueryResultRow, plan: TablePlan, users: Set<string>): QueryResultRow {
  const next = { ...row };
  for (const column of plan.optionalUserColumns || []) {
    const value = next[column];
    if (value && !users.has(String(value))) next[column] = null;
  }
  return next;
}

async function copyTable(source: Pool, target: PoolClient, plan: TablePlan, users: Set<string>, options: MigrationOptions) {
  if (plan.enabled && !plan.enabled(options)) return { table: plan.name, disabled: true };
  const sourceCount = await countRows(source, plan.name);
  const result = await source.query(`select ${plan.columns.map(qi).join(", ")} from public.${qi(plan.name)}`);
  const rows = result.rows.filter((row) => rowAllowed(row, plan, users)).map((row) => normalizeOptionalUsers(row, plan, users));
  const skipped = result.rows.length - rows.length;
  if (!options.apply || !rows.length) return { table: plan.name, source: sourceCount, selected: rows.length, written: 0, skipped };
  const updateColumns = plan.columns.filter((column) => !plan.conflictColumns.includes(column));
  const conflict = plan.conflictColumns.map(qi).join(", ");
  const updates = updateColumns.length ? `do update set ${updateColumns.map((column) => `${qi(column)} = excluded.${qi(column)}`).join(", ")}` : "do nothing";
  await target.query(
    `insert into public.${qi(plan.name)} (${plan.columns.map(qi).join(", ")}) values ${placeholders(rows.length, plan.columns.length)} on conflict (${conflict}) ${updates}`,
    rows.flatMap((row) => plan.columns.map((column) => row[column])),
  );
  return { table: plan.name, source: sourceCount, selected: rows.length, written: rows.length, skipped };
}

async function runMigration(options: MigrationOptions) {
  const source = sourcePool();
  try {
    return await transaction(async (target) => {
      const summary: unknown[] = [];
      summary.push(await migrateUsers(source, target, options.apply));
      const users = await knownTargetUsers(target);
      for (const plan of plans) summary.push(await copyTable(source, target, plan, users, options));
      if (!options.apply) throw Object.assign(new Error("dry-run rollback"), { dryRunSummary: summary });
      return summary;
    });
  } catch (error) {
    if (error instanceof Error && "dryRunSummary" in error) return (error as Error & { dryRunSummary: unknown[] }).dryRunSummary;
    throw error;
  } finally {
    await source.end();
  }
}

function isAuthorized(req: Request): boolean {
  const secret = process.env.ANNWORD_MIGRATION_SECRET || "";
  const header = req.headers["x-annword-migration-secret"];
  return Boolean(secret) && typeof header === "string" && header === secret;
}

migrationRouter.post("/supabase", async (req: Request, res: Response) => {
  if (!isAuthorized(req)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const options: MigrationOptions = {
    apply: req.body?.apply === true,
    includeGameEvents: req.body?.includeGameEvents !== false,
    includeAnalytics: req.body?.includeAnalytics === true,
  };
  try {
    const startedAt = Date.now();
    const summary = await runMigration(options);
    res.json({ ok: true, mode: options.apply ? "apply" : "dry-run", durationMs: Date.now() - startedAt, summary });
  } catch (error) {
    console.error("Yandex-side migration failed", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Migration failed" });
  }
});
