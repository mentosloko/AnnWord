/// <reference types="vite/client" />

const viteEnv = ((import.meta as any).env || {}) as Record<string, string | undefined>;
const rawApiUrl = viteEnv.VITE_API_URL || "";
const BACKEND_TOKEN_STORAGE_KEY = "annword_backend_access_token_v1";

export const isBackendApiConfigured = Boolean(rawApiUrl);
export const backendApiBaseUrl = rawApiUrl.replace(/\/+$/, "");

export function readBackendAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(BACKEND_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writeBackendAccessToken(token: string | null | undefined): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(BACKEND_TOKEN_STORAGE_KEY, token);
    else window.localStorage.removeItem(BACKEND_TOKEN_STORAGE_KEY);
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

export async function backendApiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!backendApiBaseUrl) {
    throw new BackendApiError("Backend API is not configured", 0);
  }

  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const token = readBackendAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${backendApiBaseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    credentials: "omit",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await response.json().catch(() => null) as { error?: string } | T | null;
  if (!response.ok) {
    if (response.status === 401) writeBackendAccessToken(null);
    throw new BackendApiError(payload && typeof payload === "object" && "error" in payload && payload.error ? payload.error : "Backend API request failed", response.status);
  }

  rememberBackendSession(payload);
  return payload as T;
}
