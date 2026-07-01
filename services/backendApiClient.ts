/// <reference types="vite/client" />

const viteEnv = ((import.meta as any).env || {}) as Record<string, string | undefined>;
const BACKEND_TOKEN_STORAGE_KEY = "annword_backend_access_token_v1";
const BACKEND_COOKIE_SYNC_STORAGE_KEY = "annword_backend_cookie_synced_v1";

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

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
};

async function doFetch<T>(path: string, options: RequestOptions, useHeaderToken: boolean): Promise<{ response: Response; payload: ({ error?: string } | T | null) }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const token = readBackendAccessToken();
  if (token && useHeaderToken) headers["X-AnnWord-Session"] = token;

  const response = await fetch(`${backendApiBaseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await response.json().catch(() => null) as { error?: string } | T | null;
  return { response, payload };
}

export async function backendApiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!backendApiBaseUrl) {
    throw new BackendApiError("Backend API is not configured", 0);
  }

  const method = options.method || "GET";
  const token = readBackendAccessToken();
  const canTryCookieOnly = method === "GET" && Boolean(token) && readBackendCookieSynced();
  const attempts = canTryCookieOnly ? [false, true] : [true];

  for (let index = 0; index < attempts.length; index += 1) {
    const useHeaderToken = attempts[index];
    const { response, payload } = await doFetch<T>(path, options, useHeaderToken);

    if (response.ok) {
      rememberBackendSession(payload);
      return payload as T;
    }

    if (response.status === 401 && !useHeaderToken && index + 1 < attempts.length) {
      writeBackendCookieSynced(false);
      continue;
    }

    if (response.status === 401) {
      writeBackendAccessToken(null);
      writeBackendCookieSynced(false);
    }
    throw new BackendApiError(payload && typeof payload === "object" && "error" in payload && payload.error ? payload.error : "Backend API request failed", response.status);
  }

  throw new BackendApiError("Backend API request failed", 0);
}
