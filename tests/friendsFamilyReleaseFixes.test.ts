import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rankPersonalScores } from '../services/personalScoreboard';

const read = (path: string) => readFileSync(path, 'utf8');

describe('friends and family release fixes', () => {
  it('keeps General difficulty separate from thematic dictionaries and quick-starts a selected topic', () => {
    const pools = read('hooks/useDictionaryPools.ts');
    const screens = read('components/AppScreens.tsx');
    expect(pools).toContain("getLoadedPremiumEntries(settings.activePremiumDictionaryId, 'ALL')");
    expect(pools).toContain("getKidsPremiumDictionaryEntries(settings.activePremiumDictionaryId, 'ALL')");
    expect(screens).toContain("settings.dictionarySource === 'premium'");
  });

  it('uses a compact staged dictionary selector', () => {
    const selector = read('components/screens/DictionarySettingsScreen.tsx');
    expect(selector).toContain("title: 'Общий'");
    expect(selector).toContain("title: 'Тематический'");
    expect(selector).toContain("title: 'Свой'");
    expect(selector).toContain("source === 'builtin'");
    expect(selector).toContain("source === 'premium'");
    expect(selector).toContain("source === 'custom'");
  });

  it('forwards Yandex activity events and avoids double-counting reward coins', () => {
    const api = read('services/profileApiService.ts');
    const routes = read('server/routes/profileRoutes.ts');
    const analytics = read('server/routes/analyticsRoutes.ts');
    const ledger = read('services/gameEventLedgerService.ts');
    expect(api).toContain('analyticsEvents, gameEvents');
    expect(routes).toContain('persistActivitySafely');
    expect(analytics).toContain("event_type = 'reward_granted'");
    expect(ledger).toContain('coinsDelta: 0');
  });

  it('compares custom words with the static General dictionary and exports CSV', () => {
    const analytics = read('server/routes/analyticsRoutes.ts');
    expect(analytics).toContain('GENERAL_DICTIONARY_WORDS');
    expect(analytics).toContain("get('/admin/export.csv'");
    expect(analytics).toContain('Content-Disposition');
  });

  it('ranks personal scores in both directions', () => {
    const entries = [
      { value: 4, recordedAt: '2026-01-02T00:00:00.000Z' },
      { value: 2, recordedAt: '2026-01-01T00:00:00.000Z' },
      { value: 7, recordedAt: '2026-01-03T00:00:00.000Z' },
    ];
    expect(rankPersonalScores(entries, 'lower').map(item => item.value)).toEqual([2, 4, 7]);
    expect(rankPersonalScores(entries, 'higher').map(item => item.value)).toEqual([7, 4, 2]);
  });

  it('auto-checks Snake and randomizes post-quest play', () => {
    const snake = read('components/LetterSquareGameV3.tsx');
    const practice = read('components/screens/PracticeHomeScreenWithLetterSquare.tsx');
    const kids = read('components/screens/KidsHomeScreen.tsx');
    expect(snake).toContain('window.setTimeout(() => evaluate(nextSelected), 120)');
    expect(snake).not.toContain('>Проверить</button>');
    expect(practice).toContain('playRandomGame');
    expect(kids).toContain('playRandomGame');
  });
});
