import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { runtimeConfig } from "./config";
import { addServerTiming } from "./performanceTelemetry";

let pool: Pool | undefined;
const SLOW_QUERY_MS = Number.parseInt(process.env.DB_SLOW_QUERY_MS || "500", 10);
const SLOW_POOL_WAIT_MS = Number.parseInt(process.env.DB_SLOW_POOL_WAIT_MS || "250", 10);

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

function queryLabel(text: string): { operation: string; relation: string | null } {
  const compact = text.replace(/\s+/g, " ").trim();
  const operation = compact.split(" ")[0]?.toUpperCase() || "QUERY";
  const relationMatch = compact.match(/\b(?:from|into|update|join)\s+([a-zA-Z0-9_."]+)/i);
  return { operation, relation: relationMatch?.[1]?.replace(/"/g, "") || null };
}

function logSlowDatabaseEvent(event: string, durationMs: number, details: Record<string, unknown> = {}): void {
  console.warn("AnnWord database performance", {
    event,
    durationMs,
    ...details,
  });
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

    console.warn("AnnWord database connection retry", {
      event: "db_connection_retry",
      message: error instanceof Error ? error.message : String(error || "unknown"),
    });
    await resetPoolAfterConnectionError();
    return operation();
  }
}

function getPool(): Pool | undefined {
  if (!runtimeConfig.databaseUrl) {
    return undefined;
  }

  if (!pool) {
    const createdPool = new Pool({
      connectionString: normalizeDatabaseConnectionString(runtimeConfig.databaseUrl),
      ssl: { rejectUnauthorized: false },
      max: Number.parseInt(process.env.PGPOOL_MAX || "8", 10),
      idleTimeoutMillis: Number.parseInt(process.env.PGPOOL_IDLE_TIMEOUT_MS || "30000", 10),
      connectionTimeoutMillis: Number.parseInt(process.env.PGPOOL_CONNECTION_TIMEOUT_MS || "5000", 10),
      keepAlive: true,
      keepAliveInitialDelayMillis: Number.parseInt(process.env.PGPOOL_KEEPALIVE_DELAY_MS || "10000", 10),
    });
    createdPool.on("error", (error) => {
      console.error(JSON.stringify({
        level: "ERROR",
        message: "PostgreSQL idle client error",
        event: "db_pool_idle_error",
        code: (error as NodeJS.ErrnoException).code || null,
        detail: error.message,
      }));
      if (pool === createdPool) pool = undefined;
      void createdPool.end().catch(() => undefined);
    });
    pool = createdPool;
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

async function runPoolQuery<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[]): Promise<QueryResult<T>> {
  const waitStartedAt = performance.now();
  const client = await requirePool().connect();
  const poolWaitMs = performance.now() - waitStartedAt;
  addServerTiming("db_wait", poolWaitMs);
  if (poolWaitMs >= SLOW_POOL_WAIT_MS) logSlowDatabaseEvent("db_pool_wait_slow", Math.round(poolWaitMs));

  try {
    const queryStartedAt = performance.now();
    const result = await client.query<T>(text, params);
    const queryMs = performance.now() - queryStartedAt;
    addServerTiming("db_query", queryMs);
    if (queryMs >= SLOW_QUERY_MS) logSlowDatabaseEvent("db_query_slow", Math.round(queryMs), queryLabel(text));
    return result;
  } finally {
    client.release();
  }
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  return withPoolRetry(() => runPoolQuery<T>(text, params));
}

const instrumentTransactionClient = (client: PoolClient): PoolClient => new Proxy(client, {
  get(target, property, receiver) {
    if (property === "query") {
      return async (...args: unknown[]) => {
        const startedAt = performance.now();
        try {
          return await (target.query as (...queryArgs: unknown[]) => Promise<unknown>)(...args);
        } finally {
          addServerTiming("db_query", performance.now() - startedAt);
        }
      };
    }
    const value = Reflect.get(target, property, receiver);
    return typeof value === "function" ? value.bind(target) : value;
  },
}) as PoolClient;

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const transactionStartedAt = performance.now();
  return withPoolRetry(async () => {
    const poolWaitStartedAt = performance.now();
    const client = await requirePool().connect();
    const poolWaitMs = performance.now() - poolWaitStartedAt;
    addServerTiming("db_wait", poolWaitMs);
    if (poolWaitMs >= SLOW_POOL_WAIT_MS) {
      logSlowDatabaseEvent("db_pool_wait_slow", Math.round(poolWaitMs));
    }

    try {
      await client.query("begin");
      const result = await callback(instrumentTransactionClient(client));
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback").catch(() => undefined);
      throw error;
    } finally {
      client.release();
      const durationMs = performance.now() - transactionStartedAt;
      addServerTiming("db_tx", durationMs);
      if (durationMs >= SLOW_QUERY_MS) {
        logSlowDatabaseEvent("db_transaction_slow", Math.round(durationMs), { poolWaitMs: Math.round(poolWaitMs) });
      }
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
