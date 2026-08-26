import { describe, expect, it } from 'vitest';
import { selectTargetContainerLogs } from '../scripts/filter-yandex-performance-logs.mjs';

describe('Yandex performance evidence resource filtering', () => {
  it('prefers the exact configured resource id', () => {
    const result = selectTargetContainerLogs({
      targetId: 'container-annword',
      resources: { resources: [{ type: 'serverless.container', ids: ['container-annword', 'container-other'] }] },
      records: [
        { resource: { type: 'serverless.container', id: 'container-other' }, message: 'OPTIONS other' },
        { resource: { type: 'serverless.container', id: 'container-annword' }, message: 'OPTIONS annword' },
      ],
    });
    expect(result.strategy).toBe('exact-resource-id');
    expect(result.selected).toEqual([expect.objectContaining({ message: 'OPTIONS annword' })]);
  });

  it('uses resource type fallback only when the configured id is the sole id of that type', () => {
    const result = selectTargetContainerLogs({
      targetId: 'container-annword',
      resources: { resources: [{ type: 'serverless.container', ids: ['container-annword'] }, { type: 'api.gateway', ids: ['gateway'] }] },
      records: [
        { resource: { type: 'serverless.container' }, message: 'container evidence' },
        { resource: { type: 'api.gateway' }, message: 'container text must not match' },
      ],
    });
    expect(result.strategy).toBe('unique-target-resource-type');
    expect(result.selected).toEqual([expect.objectContaining({ message: 'container evidence' })]);
  });

  it('refuses a stale configured container id', () => {
    expect(() => selectTargetContainerLogs({
      targetId: 'stale-container',
      resources: { resources: [{ type: 'serverless.container', ids: ['actual-container'] }] },
      records: [{ resource: { type: 'serverless.container' }, message: 'entry' }],
    })).toThrow(/not present/i);
  });

  it('refuses type-only fallback when multiple containers share the type', () => {
    expect(() => selectTargetContainerLogs({
      targetId: 'container-annword',
      resources: { resources: [{ type: 'serverless.container', ids: ['container-annword', 'container-other'] }] },
      records: [{ resource: { type: 'serverless.container' }, message: 'ambiguous' }],
    })).toThrow(/multiple IDs/i);
  });
});
