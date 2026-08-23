import { AsyncLocalStorage } from 'node:async_hooks';

type TimingMetric = { durationMs: number; count: number };
type TimingContext = { metrics: Map<string, TimingMetric> };

const storage = new AsyncLocalStorage<TimingContext>();

const safeMetricName = (name: string): string => name.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'metric';
const rounded = (value: number): number => Math.max(0, Math.round(value * 10) / 10);

export const runWithRequestPerformance = <T>(callback: () => T): T =>
  storage.run({ metrics: new Map<string, TimingMetric>() }, callback);

export const addServerTiming = (name: string, durationMs: number): void => {
  const context = storage.getStore();
  if (!context || !Number.isFinite(durationMs)) return;
  const key = safeMetricName(name);
  const previous = context.metrics.get(key) || { durationMs: 0, count: 0 };
  context.metrics.set(key, {
    durationMs: previous.durationMs + Math.max(0, durationMs),
    count: previous.count + 1,
  });
};

export const measureServerTiming = async <T>(name: string, operation: () => Promise<T>): Promise<T> => {
  const startedAt = performance.now();
  try {
    return await operation();
  } finally {
    addServerTiming(name, performance.now() - startedAt);
  }
};

export const getServerTimingHeader = (): string => {
  const context = storage.getStore();
  if (!context) return '';
  return Array.from(context.metrics.entries())
    .map(([name, metric]) => metric.count > 1
      ? `${name};dur=${rounded(metric.durationMs)};desc="${metric.count} ops"`
      : `${name};dur=${rounded(metric.durationMs)}`)
    .join(', ');
};
