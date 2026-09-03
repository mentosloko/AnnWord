import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string): string => readFileSync(path, 'utf8');

describe('Classic result fast path', () => {
  it('shows the terminal screen before background persistence', () => {
    const controller = source('hooks/useClassicGameController.ts');
    expect(controller).toContain('gameStatus: terminalStatus');
    expect(controller).toContain('gameStateRef.current = finishedState');
    expect(controller).toContain('void (async () => {');
    expect(controller).not.toContain('Сохраняем результат…');
  });

  it('persists a durable idempotent client outbox', () => {
    const outbox = source('services/classicResultOutboxService.ts');
    expect(outbox).toContain('annword:classic-result-outbox:v1:');
    expect(outbox).toContain("'/api/daily-quest/classic-result'");
    expect(outbox).toContain("window.addEventListener('online', retry)");
    expect(outbox).toContain("window.addEventListener('focus', retry)");
    expect(outbox).toContain('operationId');
  });

  it('applies the profile delta at most once on the server', () => {
    const repository = source('server/classicResultRepository.ts');
    expect(repository).toContain('classic-result:${userId}:${delta.operationId}');
    expect(repository).toContain('on conflict (event_key) do nothing');
    expect(repository).toContain('gamesPlayed: Math.max(0, Math.round(stats.gamesPlayed || 0)) + 1');
    expect(repository).toContain('coins = greatest(0, coins + $4::integer)');
  });

  it('combines Classic profile persistence and daily quest reconciliation in one HTTP endpoint', () => {
    const routes = source('server/routes/dailyQuestRoutes.ts');
    expect(routes).toContain('dailyQuestRouter.post("/classic-result"');
    expect(routes).toContain('applyClassicResultIdempotently');
    expect(routes).toContain('applyDailyQuestResult');
  });

  it('reuses the unified response instead of issuing a second daily quest request', () => {
    const dailyQuest = source('services/dailyQuestService.ts');
    const economy = source('hooks/useProfileEconomy.ts');
    expect(dailyQuest).toContain('registerClassicResultCommit');
    expect(dailyQuest).toContain('pendingClassicCommits.shift()');
    expect(economy).toContain('classicResultOutboxService.commit');
    expect(economy).toContain(".filter(event => event.eventType === 'reward_granted')");
  });
});
