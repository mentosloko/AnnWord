export type ServerTimingMetric = Record<string, number>;

export type RequestLoadingMetric = {
  kind: 'request';
  at: string;
  path: string;
  method: string;
  durationMs: number;
  status: number;
  ok: boolean;
  timedOut: boolean;
  deduplicated: boolean;
  serverTiming: ServerTimingMetric;
};

export type ScreenLoadingMetric = {
  kind: 'screen';
  at: string;
  screen: string;
  state: 'loading' | 'stale' | 'ready' | 'empty' | 'error';
  durationMs?: number;
  detail?: string;
};

export type LoadingMetric = RequestLoadingMetric | ScreenLoadingMetric;

const STORAGE_KEY = 'annword_loading_metrics_v1';
const MAX_METRICS = 100;
const listeners = new Set<(metric: LoadingMetric) => void>();
let memoryMetrics: LoadingMetric[] | null = null;

const isBrowser = (): boolean => typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
const now = (): number => typeof performance !== 'undefined' ? performance.now() : Date.now();

export const loadingNow = now;

export const parseServerTiming = (value: string | null): ServerTimingMetric => {
  if (!value) return {};
  const result: ServerTimingMetric = {};
  value.split(',').forEach(part => {
    const [rawName, ...params] = part.trim().split(';');
    const name = rawName?.trim();
    if (!name) return;
    const durationParam = params.find(param => /^dur=/i.test(param.trim()));
    if (!durationParam) return;
    const duration = Number(durationParam.split('=')[1]);
    if (Number.isFinite(duration)) result[name] = Math.max(0, duration);
  });
  return result;
};

const readMetrics = (): LoadingMetric[] => {
  if (memoryMetrics) return memoryMetrics;
  if (!isBrowser()) {
    memoryMetrics = [];
    return memoryMetrics;
  }
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    memoryMetrics = Array.isArray(parsed) ? parsed.slice(-MAX_METRICS) : [];
  } catch {
    memoryMetrics = [];
  }
  return memoryMetrics;
};

const persistMetrics = (): void => {
  if (!isBrowser()) return;
  try {
    const metrics = readMetrics().slice(-MAX_METRICS);
    memoryMetrics = metrics;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(metrics));
  } catch {
    // Telemetry must never affect application behavior.
  }
};

const record = (metric: LoadingMetric): void => {
  try {
    readMetrics().push(metric);
    persistMetrics();
    listeners.forEach(listener => listener(metric));
    if (metric.kind === 'request' && (!metric.ok || metric.durationMs >= 1_500)) {
      console.warn('AnnWord slow request', metric);
    }
  } catch {
    // Telemetry must never affect application behavior.
  }
};

export const loadingTelemetry = {
  recordRequest: (input: Omit<RequestLoadingMetric, 'kind' | 'at'>): void => record({ kind: 'request', at: new Date().toISOString(), ...input }),
  recordScreen: (input: Omit<ScreenLoadingMetric, 'kind' | 'at'>): void => record({ kind: 'screen', at: new Date().toISOString(), ...input }),
  subscribe: (listener: (metric: LoadingMetric) => void): (() => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getRecent: (): LoadingMetric[] => [...readMetrics()],
  clear: (): void => {
    memoryMetrics = [];
    if (isBrowser()) {
      try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    }
  },
};
