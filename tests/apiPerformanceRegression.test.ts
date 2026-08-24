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

  it('keeps runtime DDL out of request startup while applying private migrations before API start', () => {
    const api = source('server/yandex-api.ts');
    const dockerfile = source('Dockerfile.api');
    const migrate = source('scripts/yandex-db-migrate.ts');
    expect(api).toContain('RUNTIME_SCHEMA_ENSURE');
    expect(api).toContain('Runtime schema DDL skipped');
    expect(dockerfile).toContain('db:yandex:migrate && npm run api:start');
    expect(migrate).toContain('Yandex PostgreSQL migrations already current.');
    expect(migrate).toContain('pg_try_advisory_lock');
    expect(migrate).toContain('pg_advisory_unlock');
    expect(migrate).toContain('Do not hold a database connection');
    expect(migrate).toContain('GITHUB_ACTIONS');
  });

  it('aligns Yandex request concurrency with the database pool', () => {
    const workflow = source('.github/workflows/yandex-deploy.yml');
    expect(workflow).toContain('--concurrency 8');
    expect(workflow).toContain('--environment PGPOOL_MAX=8');
  });

  it('keeps unbounded assignment words out of B-tree indexes', () => {
    const migration = source('db/yandex/20260824_api_performance_indexes.sql');
    const correctiveMigration = source('db/yandex/20260824_api_performance_index_fix.sql');
    const activity = source('db/yandex/005_activity_services.sql');
    expect(migration).toContain('assigned_word_sets_learner_active_idx');
    expect(migration).not.toContain('include (words)');
    expect(migration).toContain('where archived_at is null');
    expect(correctiveMigration).toContain('drop index if exists public.assigned_word_sets_learner_active_cover_idx');
    expect(correctiveMigration).toContain('analytics_events_performance_time_idx');
    expect(activity).toContain('primary key (user_id, quest_date)');
    expect(activity).toContain('game_events_user_time_idx');
    expect(activity).toContain('analytics_events_user_time_idx');
  });

  it('keeps admin performance analytics filterable by period release and warm state', () => {
    const routes = source('server/routes/analyticsRoutes.ts');
    const adminScreen = source('components/screens/AdminAnalyticsScreen.tsx');
    const analytics = source('services/analyticsService.ts');
    expect(routes).toContain('performanceDays');
    expect(routes).toContain('performanceRelease');
    expect(routes).toContain('performanceWarmState');
    expect(routes).toContain("payload->>'coldStart'");
    expect(routes).toContain("payload->>'releaseSha'");
    expect(adminScreen).toContain('Cold p95');
    expect(adminScreen).toContain('Warm p95');
    expect(adminScreen).toContain('Все релизы');
    expect(analytics).toContain("'/api/profile/stats'");
    expect(analytics).toContain("'/api/profile/game-result'");
    expect(analytics).toContain("'/api/game-events/events'");
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

    expect(header).toMatch(/cold_start;dur=[01]/);
    expect(header).toContain('auth;dur=12.3');
    expect(header).toContain('db_wait;dur=4.2');
    expect(header).toContain('db_query;dur=10.5;desc="2 ops"');
    expect(header).toContain('hydrate;dur=1.1');
  });

  it('tags request telemetry with the deployed release SHA', () => {
    const previous = process.env.RELEASE_SHA;
    process.env.RELEASE_SHA = '97a50b40f6d0902822444b8f6c72d5c1112af85e';
    try {
      const header = runWithRequestPerformance(() => getServerTimingHeader());
      expect(header).toContain('release_97a50b40f6d0;dur=0');
    } finally {
      if (previous === undefined) delete process.env.RELEASE_SHA;
      else process.env.RELEASE_SHA = previous;
    }
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
