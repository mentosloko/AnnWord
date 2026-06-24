import { randomBytes } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import "dotenv/config";

const sourceUrl = process.env.SUPABASE_DATABASE_URL || process.env.SOURCE_DATABASE_URL || "";
const targetUrl = process.env.YANDEX_DATABASE_URL || process.env.DATABASE_URL || "";
const apply = process.env.ANNWORD_MIGRATION_APPLY === "true";
const batchSize = Math.max(1, Math.min(500, Number.parseInt(process.env.ANNWORD_MIGRATION_BATCH_SIZE || "100", 10) || 100));
const emailConflictMode = (process.env.ANNWORD_MIGRATION_EMAIL_CONFLICT || "skip").toLowerCase();

type SourceUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  email_confirmed_at: Date | null;
  created_at: Date | null;
  updated_at: Date | null;
};

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

async function targetEmailMap(client: PoolClient): Promise<Map<string, string>> {
  const result = await client.query<{ id: string; email: string }>("select id, lower(email) as email from public.app_users");
  return new Map(result.rows.map((row) => [row.email, row.id]));
}

function disabledCredentialHash(userId: string): string {
  return `migration-disabled$${userId}$${randomBytes(24).toString("base64url")}`;
}

async function readSourceUsers(source: Pool): Promise<SourceUser[]> {
  const result = await source.query<SourceUser>(`
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
  return result.rows;
}

async function migrate(source: Pool, target: PoolClient): Promise<Record<string, number>> {
  const users = await readSourceUsers(source);
  const emails = await targetEmailMap(target);
  const rows: unknown[][] = [];
  let skipped = 0;
  for (const user of users) {
    const email = user.email?.trim().toLowerCase();
    if (!email) { skipped += 1; continue; }
    const existingId = emails.get(email);
    if (existingId && existingId !== user.id && emailConflictMode === "skip") { skipped += 1; continue; }
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
  if (!apply || !rows.length) return { source: users.length, selected: rows.length, written: 0, skipped };
  const columns = ["id", "email", "password_hash", "full_name", "provider", "email_confirmed_at", "password_reset_required", "created_at", "updated_at"];
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize);
    await target.query(
      `insert into public.app_users (${columns.map(qi).join(", ")}) values ${placeholders(batch.length, columns.length)}
       on conflict (id) do update set
         email = excluded.email,
         full_name = excluded.full_name,
         provider = excluded.provider,
         email_confirmed_at = coalesce(public.app_users.email_confirmed_at, excluded.email_confirmed_at),
         password_reset_required = true,
         updated_at = now()`,
      batch.flat(),
    );
  }
  return { source: users.length, selected: rows.length, written: rows.length, skipped };
}

async function main(): Promise<void> {
  const source = pool("SUPABASE_DATABASE_URL", sourceUrl);
  const target = pool("YANDEX_DATABASE_URL or DATABASE_URL", targetUrl);
  const client = await target.connect();
  try {
    console.log(`AnnWord user skeleton migration mode: ${apply ? "apply" : "dry-run"}`);
    await client.query("begin");
    const result = await migrate(source, client);
    if (apply) await client.query("commit");
    else await client.query("rollback");
    console.table([{ table: "auth users -> app_users skeletons", ...result }]);
    if (!apply) console.log("Dry-run only. Set ANNWORD_MIGRATION_APPLY=true to write data.");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await Promise.all([source.end(), target.end()]);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
