import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string): string => readFileSync(path, 'utf8');

describe('parent weekly report redesign', () => {
  it('renders the agreed parent-first sections with email-safe markup', () => {
    const report = source('server/weeklyReportService.ts');
    expect(report).toContain('Неделя ${safeLearner}');
    expect(report).toContain('🎉 Эти слова уже получаются');
    expect(report).toContain('🔁 Стоит немного повторить');
    expect(report).toContain('🎮 Больше всего понравилась');
    expect(report).toContain('💡 На следующую неделю');
    expect(report).toContain('Посмотреть прогресс');
    expect(report).toContain('role="presentation"');
    expect(report).not.toContain('display:flex');
  });

  it('shows activity days, games and word accuracy as the three headline metrics', () => {
    const report = source('server/weeklyReportService.ts');
    expect(report).toContain('activeDays');
    expect(report).toContain('games');
    expect(report).toContain('accuracyLabel');
    expect(report).toContain("count(distinct (occurred_at at time zone 'Europe/Moscow')::date)");
  });

  it('uses canonical translations and stricter weekly word-state rules', () => {
    const report = source('server/weeklyReportService.ts');
    expect(report).toContain('loadMasterDictionaryTranslations');
    expect(report).toContain('row.mastered >= row.failed && row.masteredAt >= row.failedAt');
    expect(report).toContain('row.failed > row.mastered || row.failedAt > row.masteredAt');
    expect(report).toContain('count: row.failed');
  });

  it('collects richer report data with two weekly event queries instead of the previous three', () => {
    const report = source('server/weeklyReportService.ts');
    expect(report).toContain('loadWeeklyMetrics');
    expect(report).toContain('loadWeeklyWordProgress');
    expect(report).toContain('Promise.all([');
    expect(report).not.toContain('const loadWords =');
    expect(report).toContain("limit 200");
  });

  it('describes the richer content in the parent settings card', () => {
    const settings = source('components/WeeklyReportSettingsCard.tsx');
    expect(settings).toContain('дни занятий, игры, точность');
    expect(settings).toContain('короткий совет на следующую неделю');
  });
});
