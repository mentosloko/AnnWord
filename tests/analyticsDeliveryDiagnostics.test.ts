import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

class MockBackendApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'BackendApiError';
    this.status = status;
  }
}

const request = vi.fn();
vi.mock('../services/backendApiClient', () => ({
  backendApiRequest: request,
  BackendApiError: MockBackendApiError,
}));

describe('analytics delivery diagnostics', () => {
  beforeEach(() => {
    request.mockReset();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs endpoint, stage, duration and actionable failure reason', async () => {
    request.mockRejectedValueOnce(new MockBackendApiError('service unavailable', 503));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { analyticsService } = await import('../services/analyticsService');
    const event = analyticsService.createEvent({ eventType: 'navigation', eventName: 'route_changed', route: '/' });

    await analyticsService.sendNow([event]);

    expect(warn).toHaveBeenCalledWith('Analytics delivery failed', expect.objectContaining({
      endpoint: '/api/analytics/events',
      stage: 'immediate_send',
      durationMs: expect.any(Number),
      reason: 'http_503:service unavailable',
      batchSize: 1,
      consecutiveFailures: expect.any(Number),
      retryInMs: expect.any(Number),
    }));
  });
});
