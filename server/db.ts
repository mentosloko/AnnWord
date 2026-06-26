import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { runtimeConfig } from "./config";

let pool: Pool | undefined;

export type DatabaseHealth = {
  configured: boolean;
  ok: boolean;
  latencyMs?: number;
  error?: string;
};

function normalizeDatabaseConnectionString(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete("sslmode");
    url.searchParams.delete("sslcert");
    url.searchParams.delete("sslkey");
    url.searchParams.delete("sslrootcert");
    return url.toString();
  } catch {
    return connectionString;
  }
}

function isRetryableConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error || "").toLowerCase();
  return message.includes("connection terminated")
    || message.includes("connection reset")
    || message.includes("connection closed")
    || message.includes("server closed the connection")
    || message.includes("econnreset")
    || message.includes("terminating connection");
}

async function resetPoolAfterConnectionError(): Promise<void> {
  const currentPool = pool;
  pool = undefined;
  if (!currentPool) return;
  await currentPool.end().catch(() => undefined);
}

async function withPoolRetry<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isRetryableConnectionError(error)) {
      throw error;
    }

    await resetPoolAfterConnectionError();
    return operation();
  }
}

function getPool(): Pool | undefined {
  if (!runtimeConfig.databaseUrl) {
    return undefined;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: normalizeDatabaseConnectionString(runtimeConfig.databaseUrl),
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
  return withPoolRetry(() => requirePool().query<T>(text, params));
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  return withPoolRetry(async () => {
    const client = await requirePool().connect();

    try {
      await client.query("begin");
      const result = await callback(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  });
}

export async function checkDatabaseHealth(): Promise<DatabaseHealth> {
  if (!getPool()) {
    return {
      configured: false,
      ok: false,
      error: "DATABASE_URL or PGHOST/PGDATABASE/PGUSER/PGPASSWORD are not configured",
    };
  }

  const startedAt = Date.now();

  try {
    const result = await query<{ ok: number }>("select 1 as ok");
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