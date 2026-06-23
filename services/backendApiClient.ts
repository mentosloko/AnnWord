/// <reference types="vite/client" />

const viteEnv = ((import.meta as any).env || {}) as Record<string, string | undefined>;
const rawApiUrl = viteEnv.VITE_API_URL || "";

export const isBackendApiConfigured = Boolean(rawApiUrl);
export const backendApiBaseUrl = rawApiUrl.replace(/\/+$/, "");

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

  const response = await fetch(`${backendApiBaseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    credentials: "include",
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const payload = await response.json().catch(() => null) as { error?: string } | T | null;
  if (!response.ok) {
    throw new BackendApiError(payload && typeof payload === "object" && "error" in payload && payload.error ? payload.error : "Backend API request failed", response.status);
  }

  return payload as T;
}
