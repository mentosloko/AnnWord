import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mergeAssignedWordsIntoProfile } from '../server/profileHydration';
import { getServerTimingHeader, runWithRequestPerformance, addServerTiming } from '../server/performanceTelemetry';
import { GUEST_PROFILE } from '../constants/profileDefaults';

const source = (path: string): string => readFileSync(path, 'utf8');

describe('API performance regression guards', () => {
  it('keeps pet mood hydration on the locked transaction connection', () => {
    const petMood = source('server/petMoodRepository.ts');
    expect(petMood).toContain('left join lateral');
    expect(petMood).toContain('for update of p');
    expect(petMood).toContain('assigned_words');
    expect(petMood).not.toContain('hydrateProfileAssignments(');
  });

  it('uses combined single-transaction hot profile operations', () => {
    const routes = source('server/routes/profileRoutes.ts');
    expect(routes).toContain('updateStatsAndReconcileProfile');
    expect(routes).toContain('incrementCoinsAndReconcileProfile');
    expect(routes).toContain('applyGameResultAndReconcileProfile');
    expect(routes).not.toContain('await applyGameResult(');
  });

  it('keeps production runtime DDL out of the cold-start path', () => {
    const api = source('server/yandex-api.ts');
    expect(api).toContain('RUNTIME_SCHEMA_ENSURE');
    expect(api).toContain('Runtime schema DDL skipped');
  });

  it('aligns Yandex request concurrency with the database pool', () => {
    const workflow = source('.github/workflows/yandex-deploy.yml');
    expect(workflow).toContain('--concurrency 8');
    expect(workflow).toContain('--environment PGPOOL_MAX=8');
  });

  it('has a covering active assignment index and existing event/quest indexes', () => {
    const migration = source('db/yandex/20260824_api_performance_indexes.sql');
    const activity = source('db/yandex/005_activity_services.sql');
    expect(migration).toContain('include (words)');
    expect(migration).toContain('where archived_at is null');
    expect(activity).toContain('primary key (user_id, quest_date)');
    expect(activity).toContain('game_events_user_time_idx');
    expect(activity).toContain('analytics_events_user_time_idx');
  });

  it('batches word-level ledger requests instead of posting every event immediately', () => {
    const ledger = source('services/gameEventLedgerService.ts');
    expect(ledger).toContain('EVENT_FLUSH_DELAY_MS');
    expect(ledger).toContain('queuedEvents.push(...safeEvents)');
    expect(ledger).toContain('body: { events: batch }');
  });
});

describe('request timing telemetry', () => {
  it('aggregates auth, db wait/query and hydration timings into Server-Timing', () => {
    const header = runWithRequestPerformance(() => {
      addServerTiming('auth', 12.3);
      addServerTiming('db_wait', 4.2);
      addServerTiming('db_query', 8.1);
      addServerTiming('db_query', 2.4);
      addServerTiming('hydrate', 1.1);
      return getServerTimingHeader();
    });

    expect(header).toContain('auth;dur=12.3');
    expect(header).toContain('db_wait;dur=4.2');
    expect(header).toContain('db_query;dur=10.5;desc="2 ops"');
    expect(header).toContain('hydrate;dur=1.1');
  });
});

describe('profile assignment hydration', () => {
  it('merges assigned words without changing the rest of the profile', () => {
    const profile = { ...GUEST_PROFILE, customDictionaryEn: ['BOOK'] };
    const hydrated = mergeAssignedWordsIntoProfile(profile, [' school ', 'BOOK', 'school']);
    expect(hydrated.assignedWords).toEqual(['SCHOOL', 'BOOK']);
    expect(hydrated.customDictionaryEn).toEqual(['BOOK', 'SCHOOL']);
    expect(hydrated.pet).toEqual(profile.pet);
  });
});
