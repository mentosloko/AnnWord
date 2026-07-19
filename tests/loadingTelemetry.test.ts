import { afterEach, describe, expect, it } from 'vitest';
import { loadingTelemetry, parseServerTiming } from '../services/loadingTelemetry';

afterEach(() => {
  loadingTelemetry.clear();
  window.sessionStorage.clear();
});

describe('loading telemetry', () => {
  it('parses Server-Timing durations', () => {
    expect(parseServerTiming('bootstrap_total;dur=421.7, db_query;dur=83')).toEqual({
      bootstrap_total: 421.7,
      db_query: 83,
    });
  });

  it('keeps request and screen states in the session buffer', () => {
    loadingTelemetry.recordRequest({
      path: '/api/profile/bootstrap',
      method: 'GET',
      durationMs: 1200,
      status: 200,
      ok: true,
      timedOut: false,
      deduplicated: false,
      serverTiming: { bootstrap_total: 900 },
    });
    loadingTelemetry.recordScreen({
      screen: 'adult_room',
      state: 'ready',
      durationMs: 1350,
    });

    expect(loadingTelemetry.getRecent()).toHaveLength(2);
    expect(loadingTelemetry.getRecent()[0]).toMatchObject({ kind: 'request', path: '/api/profile/bootstrap' });
    expect(loadingTelemetry.getRecent()[1]).toMatchObject({ kind: 'screen', screen: 'adult_room', state: 'ready' });
  });
});
