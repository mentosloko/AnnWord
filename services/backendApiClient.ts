/// <reference types="vite/client" />

import { loadingNow, loadingTelemetry, parseServerTiming, type ServerTimingMetric } from './loadingTelemetry';

const viteEnv = ((import.meta as any).env || {}) as Record<string, string | undefined>;
const BACKEND_TOKEN_STORAGE_KEY = "annword_backend_access_token_v1";
const BACKEND_COOKIE_SYNC_STORAGE_KEY = "annword_backend_cookie_synced_v1";
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const pendingGetRequests = new Map<string, Promise<unknown>>();

const normalizeBaseUrl = (value: string | undefined): string => (value || "").trim().replace(/\/+$/, "");

const runtimeApiFallback = (): string => {
  if (typeof window === "undefined") return "";
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === "annword.ru" || hostname === "www.annword.ru") return "https://api.annword.ru";
  return "";
};

const rawApiUrl = normalizeBaseUrl(viteEnv.VITE_API_URL || viteEnv.VITE_YC_API_PUBLIC_URL || runtimeApiFallback());

export const isBackendApiConfigured = Boolean(rawApiUrl);
export const backendApiBaseUrl = rawApiUrl;

export function readBackendAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(BACKEND_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function readBackendCookieSynced(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(BACKEND_COOKIE_SYNC_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeBackendCookieSynced(value: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (value) window.localStorage.setItem(BACKEND_COOKIE_SYNC_STORAGE_KEY, "1");
    else window.localStorage.removeItem(BACKEND_COOKIE_SYNC_STORAGE_KEY);
  } catch {
    // Local auth persistence must not break the app shell.
  }
}

export function writeBackendAccessToken(token: string | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(BACKEND_TOKEN_STORAGE_KEY, token);
    else {
      window.localStorage.removeItem(BACKEND_TOKEN_STORAGE_KEY);
      writeBackendCookieSynced(false);
    }
  } catch {
    // Local auth persistence must not break the app shell.
  }
}

function rememberBackendSession(payload: unknown): void {
  if (!payload || typeof payload !== "object") return;
  const value = (payload as { access_token?: unknown }).access_token;
  if (typeof value === "string" && value.length > 0) {
    writeBackendAccessToken(value);
  }
  if ((payload as { cookie_synced?: unknown }).cookie_synced === true) {
    writeBackendCookieSynced(true);
  }
}

export class BackendApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "BackendApiError";
    this.status = status;
  }
}

export type BackendRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  timeoutMs?: number;
  dedupe?: boolean;
};

type FetchResult<T> = {
  response: Response;
  payload: { error?: string } | T | null;
  serverTiming: ServerTimingMetric;
};

const abortError = (path: string, timedOut: boolean): BackendApiError => new BackendApiError(
  timedOut ? `Сервер слишком долго отвечает (${path}). Попробуйте ещё раз.` : "Запрос отменён.",
  0,
);

const isTimeoutError = (error: unknown): boolean => error instanceof BackendApiError && /слишком долго отвечает/i.test(error.message);
const errorStatus = (error: unknown): number => error instanceof BackendApiError ? error.status : 0;

async function doFetch<T>(path: string, options: BackendRequestOptions, useHeaderToken: boolean): Promise<FetchResult<T>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const token = readBackendAccessToken();
  if (token && useHeaderToken) headers["X-AnnWord-Session"] = token;

  const controller = new AbortController();
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS);
  let timedOut = false;
  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener("abort", abortFromCaller, { once: true });

  try {
    const method = options.method || "GET";
    const maxAttempts = method === "GET" ? 2 : 1;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const response = await fetch(`${backendApiBaseUrl}${path}`, {
          method,
          headers,
          credentials: "include",
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null) as { error?: string } | T | null;
        return { response, payload, serverTiming: parseServerTiming(response.headers.get('Server-Timing')) };
      } catch (error) {
        if (controller.signal.aborted) throw abortError(path, timedOut);
        const networkFailure = error instanceof TypeError || /failed to fetch|networkerror|load failed/i.test(error instanceof Error ? error.message : String(error));
        if (networkFailure && attempt + 1 < maxAttempts) {
          await new Promise(resolve => globalThis.setTimeout(resolve, 250));
          continue;
        }
        if (networkFailure) throw new BackendApiError("Не удалось связаться с сервером AnnWord. Проверьте соединение и повторите действие.", 0);
        throw error;
      }
    }
    throw new BackendApiError("Не удалось связаться с сервером AnnWord.", 0);
  } finally {
    globalThis.clearTimeout(timeoutId);
    options.signal?.removeEventListener("abort", abortFromCaller);
  }
}

async function executeBackendRequest<T>(path: string, options: BackendRequestOptions): Promise<T> {
  const startedAt = loadingNow();
  const method = options.method || "GET";
  const token = readBackendAccessToken();
  const canTryCookieOnly = method === "GET" && Boolean(token) && readBackendCookieSynced();
  const attempts = canTryCookieOnly ? [false, true] : [true];
  let status = 0;
  let serverTiming: ServerTimingMetric = {};

  try {
    for (let index = 0; index < attempts.length; index += 1) {
      const useHeaderToken = attempts[index];
      const result = await doFetch<T>(path, options, useHeaderToken);
      status = result.response.status;
      serverTiming = result.serverTiming;

      if (result.response.ok) {
        rememberBackendSession(result.payload);
        loadingTelemetry.recordRequest({
          path,
          method,
          durationMs: Math.round(loadingNow() - startedAt),
          status,
          ok: true,
          timedOut: false,
          deduplicated: false,
          serverTiming,
        });
        return result.payload as T;
      }

      if (result.response.status === 401 && !useHeaderToken && index + 1 < attempts.length) {
        writeBackendCookieSynced(false);
        continue;
      }

      if (result.response.status === 401) {
        writeBackendAccessToken(null);
        writeBackendCookieSynced(false);
      }
      throw new BackendApiError(result.payload && typeof result.payload === "object" && "error" in result.payload && result.payload.error ? result.payload.error : "Backend API request failed", result.response.status);
    }

    throw new BackendApiError("Backend API request failed", 0);
  } catch (error) {
    loadingTelemetry.recordRequest({
      path,
      method,
      durationMs: Math.round(loadingNow() - startedAt),
      status: status || errorStatus(error),
      ok: false,
      timedOut: isTimeoutError(error),
      deduplicated: false,
      serverTiming,
    });
    throw error;
  }
}

export async function backendApiRequest<T>(path: string, options: BackendRequestOptions = {}): Promise<T> {
  if (!backendApiBaseUrl) {
    throw new BackendApiError("Backend API is not configured", 0);
  }

  const method = options.method || "GET";
  const shouldDedupe = method === "GET" && options.dedupe !== false && !options.signal;
  if (!shouldDedupe) return executeBackendRequest<T>(path, options);

  const key = `${method}:${path}`;
  const existing = pendingGetRequests.get(key);
  if (existing) {
    const joinedAt = loadingNow();
    try {
      const result = await existing as T;
      loadingTelemetry.recordRequest({
        path,
        method,
        durationMs: Math.round(loadingNow() - joinedAt),
        status: 200,
        ok: true,
        timedOut: false,
        deduplicated: true,
        serverTiming: {},
      });
      return result;
    } catch (error) {
      loadingTelemetry.recordRequest({
        path,
        method,
        durationMs: Math.round(loadingNow() - joinedAt),
        status: errorStatus(error),
        ok: false,
        timedOut: isTimeoutError(error),
        deduplicated: true,
        serverTiming: {},
      });
      throw error;
    }
  }

  const pending = executeBackendRequest<T>(path, options).finally(() => {
    pendingGetRequests.delete(key);
  });
  pendingGetRequests.set(key, pending);
  return pending;
}
