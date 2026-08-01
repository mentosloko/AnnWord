import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { DailyQuestState, UserProfile } from '../types';
import { calculateGameReward } from '../services/gamificationRules';
import { DAILY_QUEST_DEFINITIONS, doesGameResultCompleteDailyQuest, getMemoryMovesFromResult } from '../services/dailyQuest';
import { resolveAccessibleRoute } from '../services/routeAccess';

const profile = (mode: 'player' | 'parent' | 'teacher', overrides: Partial<UserProfile> = {}): UserProfile => ({
  username: 'test',
  role: mode === 'parent' ? 'parent' : mode === 'teacher' ? 'teacher' : 'user',
  accountMode: mode,
  subscriptionTier: 'free',
  customDictionaryEn: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {}, wordsToReview: {} },
  pet: { name: 'Друг', type: 'Puppy', level: 1, mood: 'happy', xp: 0, characterOnboarded: mode !== 'parent', equippedAccessories: [] },
  coins: 0,
  inventory: [],
  ...(mode === 'parent' ? { childDisplayName: 'Аня', childShareCode: 'ABC123', pet: { name: 'Друг', type: 'Puppy', level: 1, mood: 'happy', xp: 0, characterOnboarded: true, equippedAccessories: [] } } : {}),
  ...overrides,
});

const memoryQuest = (description: string): DailyQuestState => ({
  questDate: '2026-07-24',
  kind: 'memory_sixteen',
  title: 'Память дня',
  description,
  progressLabel: 'Ещё не выполнено',
  completed: false,
});

describe('systemic route access', () => {
  it('redirects incompatible role routes before rendering them', () => {
    expect(resolveAccessibleRoute('shop', profile('teacher'), true)).toBe('adult_room');
    expect(resolveAccessibleRoute('pet_room', profile('player'), true)).toBe('landing');
    expect(resolveAccessibleRoute('admin', profile('parent'), true)).toBe('landing');
  });

  it('does not reopen child setup for an already configured Kids account', () => {
    expect(resolveAccessibleRoute('family_setup', profile('parent'), true)).toBe('landing');
  });
});

describe('Memory moves contract', () => {
  it('uses one move for each pair of legacy clicks', () => {
    expect(getMemoryMovesFromResult({ moves: 7 })).toBe(7);
    expect(getMemoryMovesFromResult({ clicks: 13 })).toBe(7);
    expect(calculateGameReward({ type: 'memory', moves: 6 })).toEqual(calculateGameReward({ type: 'memory', clicks: 12 }));
  });

  it('completes a Memory quest only within the move target', () => {
    const quest = memoryQuest(DAILY_QUEST_DEFINITIONS.memory_fourteen.description);
    expect(doesGameResultCompleteDailyQuest(quest, { type: 'memory', moves: 9 })).toBe(true);
    expect(doesGameResultCompleteDailyQuest(quest, { type: 'memory', moves: 10 })).toBe(false);
  });
});

describe('parent and dictionary regression contracts', () => {
  it('keeps server-side parent checks on Kids checkout and settings', () => {
    const payments = readFileSync('server/routes/paymentRoutes.ts', 'utf8');
    const profileRoutes = readFileSync('server/routes/profileRoutes.ts', 'utf8');
    expect(payments).toContain('requireParentAccessForKids');
    expect(payments).toMatch(/post\("\/create", requireAuth, requireParentAccessForKids/);
    expect(profileRoutes).toMatch(/patch\("\/dictionary", requireParentAccessForKids/);
  });

  it('requires the parent PIN in the Kids payment UI', () => {
    const premium = readFileSync('components/screens/PremiumScreen.tsx', 'utf8');
    const kidsHome = readFileSync('components/screens/KidsHomeScreen.tsx', 'utf8');
    expect(premium).toContain('familyAccountService.verifyParentPin');
    expect(premium).toContain('Подтвердить и перейти к оплате');
    expect(kidsHome).toContain('Подробнее о Kids Premium');
  });

  it('freezes the loaded dictionary before opening a mini-game', () => {
    const appScreens = readFileSync('components/AppScreens.tsx', 'utf8');
    const setup = readFileSync('components/screens/SetupScreenSafe.tsx', 'utf8');
    expect(appScreens).toContain('GameDictionarySnapshot');
    expect(setup).toContain('dictionaryRuntime.getModeWords');
    expect(setup).toContain('onStartGame(dictionarySnapshot)');
  });

  it('keeps the pet room vertically scrollable and removes Memory click copy', () => {
    const appScreens = readFileSync('components/AppScreens.tsx', 'utf8');
    const memory = readFileSync('components/MemoryGame.tsx', 'utf8');
    expect(appScreens).toContain('overflow-y-auto overscroll-contain');
    expect(memory).toContain('Ходов: {moves}');
    expect(memory).not.toContain('Кликов:');
    expect(memory).not.toContain('clicks');
  });
});
