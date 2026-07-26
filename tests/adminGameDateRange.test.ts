import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('admin game statistics range', () => {
  it('sends game starts immediately with queue fallback', () => {
    const source = read('services/analyticsService.ts');
    expect(source).toContain("if (input.eventName === 'game_started')");
    expect(source).toContain('void analyticsService.sendNow([event])');
  });

  it('uses inclusive date inputs and groups the table by game mode', () => {
    const source = read('components/screens/AdminAnalyticsScreen.tsx');
    expect(source.match(/type="date"/g)).toHaveLength(2);
    expect(source).toContain('Игры за период');
    expect(source).toContain('formatGameType(row.game_type)');
    expect(source).not.toContain('key={`${row.day}-${row.game_type}-${index}`}');
  });

  it('never reports fewer starts than recorded finishes', () => {
    const source = read('server/routes/analyticsRoutes.ts');
    expect(source).toContain('sum(greatest(recorded_starts, finishes))');
    expect(source).toContain('inferred_starts');
  });
});
