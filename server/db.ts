import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { runtimeConfig } from "./config";

let pool: Pool | undefined;

export type DatabaseHealth = {
  configured: boolean;
  ok: boolean;
  latencyMs?: number;
  error?: string;
};

function getPool(): Pool | undefined {
  if (!runtimeConfig.databaseUrl) {
    return undefined;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: runtimeConfig.databaseUrl,
      ssl: { rejectUnauthorized: false },
      max: Number.parseInt(process.env.PGPOOL_MAX || "5", 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
  }

  return pool;
}

export function requirePool(): Pool {
  const databasePool = getPool();
  if (!databasePool) {
    throw new Error("DATABASE_URL or PGHOST/PGDATABASE/PGUSER/PGPASSWORD are not configured");
  }

  return databasePool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  return requirePool().query<T>(text, params);
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await requirePool().connect();

  try {
    await client.query("begin");
    const result = await callback(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  const databasePool = getPool();
  if (!databasePool) {
    return {
      configured: false,
      ok: false,
      error: "DATABASE_URL or PGHOST/PGDATABASE/PGUSER/PGPASSWORD are not configured",
    };
  }

  const startedAt = Date.now();

  try {
    const result = await databasePool.query<{ ok: number }>("select 1 as ok");
    const ok = result.rows[0]?.ok === 1;

    return {
      configured: true,
      ok,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      configured: true,
      ok: false,
      latencyMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}

export async function closeDatabasePool(): Promise<void> {
  if (!pool) {
    return;
  }

  const currentPool = pool;
  pool = undefined;
  await currentPool.end();
}
