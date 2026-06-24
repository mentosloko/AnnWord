import { Pool, type PoolClient, type QueryResultRow } from "pg";
import "dotenv/config";

type TablePlan = {
  name: string;
  columns: string[];
  conflictColumns: string[];
  requiresKnownUsers?: string[];
  optionalUserColumns?: string[];
  enabled?: () => boolean;
};

type MigrationMode = "dry-run" | "apply";

const sourceUrl = process.env.SUPABASE_DATABASE_URL || process.env.SOURCE_DATABASE_URL || "";
const targetUrl = process.env.YANDEX_DATABASE_URL || process.env.DATABASE_URL || "";
const mode: MigrationMode = process.env.ANNWORD_MIGRATION_APPLY === "true" ? "apply" : "dry-run";
const includeAnalytics = process.env.ANNWORD_MIGRATION_INCLUDE_ANALYTICS === "true";
const includeGameEvents = process.env.ANNWORD_MIGRATION_INCLUDE_GAME_EVENTS !== "false";
const batchSize = Math.max(1, Math.min(500, Number.parseInt(process.env.ANNWORD_MIGRATION_BATCH_SIZE || "100", 10) || 100));

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
  {
    name: "dictionary_collections",
    columns: ["id", "owner_user_id", "title", "source", "class_label", "theme", "words", "metadata", "created_at", "updated_at", "archived_at"],
    conflictColumns: ["id"],
    requiresKnownUsers: ["owner_user_id"],
  },
  {
    name: "adult_learner_links",
    columns: ["adult_user_id", "learner_user_id", "relation_role", "class_label", "created_at"],
    conflictColumns: ["adult_user_id", "learner_user_id"],
    requiresKnownUsers: ["adult_user_id", "learner_user_id"],
  },
  {
    name: "assigned_word_sets",
    columns: ["id", "adult_user_id", "learner_user_id", "title", "class_label", "theme", "source", "words", "created_at", "archived_at"],
    conflictColumns: ["id"],
    requiresKnownUsers: ["adult_user_id", "learner_user_id"],
  },
  {
    name: "weekly_report_subscriptions",
    columns: ["adult_user_id", "learner_user_id", "email", "enabled", "weekday", "last_sent_at", "created_at"],
    conflictColumns: ["adult_user_id", "learner_user_id"],
    requiresKnownUsers: ["adult_user_id", "learner_user_id"],
  },
  {
    name: "weekly_report_outbox",
    columns: ["id", "adult_user_id", "learner_user_id", "email", "week_start", "payload", "status", "created_at", "sent_at"],
    conflictColumns: ["id"],
    requiresKnownUsers: ["adult_user_id", "learner_user_id"],
  },
  {
    name: "premium_requests",
    columns: ["id", "user_id", "email", "product_code", "provider", "provider_payment_id", "status", "requested_at", "paid_at", "activated_at", "premium_months", "metadata", "created_at", "updated_at"],
    conflictColumns: ["id"],
    requiresKnownUsers: ["user_id"],
  },
  {
    name: "premium_payments",
    columns: ["id", "user_id", "provider", "provider_order_id", "provider_payment_id", "plan_code", "period_days", "amount_rub", "currency", "status", "checkout_url", "customer_email", "paid_at", "premium_expires_at", "raw_payload", "created_at", "updated_at"],
    conflictColumns: ["id"],
    requiresKnownUsers: ["user_id"],
  },
  {
    name: "prodamus_webhook_events",
    columns: ["id", "provider", "provider_order_id", "provider_payment_id", "status", "signature_valid", "is_paid", "error", "raw_payload", "created_at"],
    conflictColumns: ["id"],
  },
  {
    name: "daily_quests",
    columns: ["user_id", "quest_date", "kind", "progress", "completed", "completed_at", "reward_item_id", "created_at", "reward_world_id"],
    conflictColumns: ["user_id", "quest_date"],
    requiresKnownUsers: ["user_id"],
  },
  {
    name: "game_events",
    columns: ["id", "user_id", "event_key", "event_type", "game_mode", "word", "result", "quest_date", "quest_kind", "coins_delta", "xp_delta", "payload", "occurred_at", "created_at"],
    conflictColumns: ["id"],
    requiresKnownUsers: ["user_id"],
    enabled: () => includeGameEvents,
  },
  {
    name: "analytics_events",
    columns: ["id", "user_id", "session_id", "event_type", "event_name", "game_type", "route", "occurred_at", "payload", "app_version", "user_agent", "device_type", "created_at"],
    conflictColumns: ["id"],
    optionalUserColumns: ["user_id"],
    enabled: () => includeAnalytics,
  },
];

function pool(label: string, connectionString: string): Pool {
  if (!connectionString) throw new Error(`${label} is not configured.`);
  return new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 3, connectionTimeoutMillis: 10_000 });
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

async function copyTable(source: Pool, target: PoolClient, plan: TablePlan, users: Set<string>) {
  if (plan.enabled && !plan.enabled()) return { source: 0, selected: 0, written: 0, skipped: 0, disabled: true };
  const sourceCount = await countRows(source, plan.name);
  const result = await source.query(`select ${plan.columns.map(qi).join(", ")} from public.${qi(plan.name)}`);
  const rows = result.rows.filter((row) => rowAllowed(row, plan, users)).map((row) => normalizeOptionalUsers(row, plan, users));
  const skipped = result.rows.length - rows.length;
  if (mode === "dry-run" || !rows.length) return { source: sourceCount, selected: rows.length, written: mode === "apply" ? rows.length : 0, skipped };
  const updateColumns = plan.columns.filter((column) => !plan.conflictColumns.includes(column));
  const conflict = plan.conflictColumns.map(qi).join(", ");
  const updates = updateColumns.length
    ? `do update set ${updateColumns.map((column) => `${qi(column)} = excluded.${qi(column)}`).join(", ")}`
    : "do nothing";
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    await target.query(
      `insert into public.${qi(plan.name)} (${plan.columns.map(qi).join(", ")}) values ${placeholders(batch.length, plan.columns.length)} on conflict (${conflict}) ${updates}`,
      batch.flatMap((row) => plan.columns.map((column) => row[column])),
    );
  }
  return { source: sourceCount, selected: rows.length, written: rows.length, skipped };
}

async function main(): Promise<void> {
  const source = pool("SUPABASE_DATABASE_URL", sourceUrl);
  const target = pool("YANDEX_DATABASE_URL or DATABASE_URL", targetUrl);
  const targetClient = await target.connect();
  const summary: Array<Record<string, unknown>> = [];
  try {
    console.log(`AnnWord core data migration mode: ${mode}`);
    console.log(`batchSize=${batchSize}; includeGameEvents=${includeGameEvents}; includeAnalytics=${includeAnalytics}`);
    await targetClient.query("begin");
    const users = await knownTargetUsers(targetClient);
    summary.push({ table: "target app_users", count: users.size, note: "core data is copied only for known target users" });
    for (const plan of plans) summary.push({ table: plan.name, ...(await copyTable(source, targetClient, plan, users)) });
    if (mode === "apply") await targetClient.query("commit");
    else await targetClient.query("rollback");
    console.table(summary);
    if (mode === "dry-run") console.log("Dry-run only. Set ANNWORD_MIGRATION_APPLY=true to write data.");
  } catch (error) {
    await targetClient.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    targetClient.release();
    await Promise.all([source.end(), target.end()]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
