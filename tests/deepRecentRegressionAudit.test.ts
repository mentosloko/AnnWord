import { describe, expect, it } from 'vitest';
import { GUEST_PROFILE } from '../constants/profileDefaults';
import { getAllFiveQuestCompletedMode } from '../services/dailyQuest';
import { resolveOwnedProfileUpdate } from '../services/profileAccessState';
import type { GameRewardInput } from '../services/gamificationRules';
import type { UserProfile } from '../types';
import { readFileSync } from 'node:fs';

const profile = (username: string, coins = 0): UserProfile => ({
  ...GUEST_PROFILE,
  username,
  coins,
  stats: { ...GUEST_PROFILE.stats, wordsGuessed: { ...GUEST_PROFILE.stats.wordsGuessed } },
  pet: { ...GUEST_PROFILE.pet, equippedAccessories: [...(GUEST_PROFILE.pet.equippedAccessories || [])] },
  inventory: [...GUEST_PROFILE.inventory],
  customDictionaryEn: [...GUEST_PROFILE.customDictionaryEn],
});
const result = (input: Partial<GameRewardInput>): GameRewardInput => input as GameRewardInput;
const read = (path: string): string => readFileSync(path, 'utf8');

describe('deep recent regression audit', () => {
  it('rejects a delayed profile response from a previous account', () => {
    const current = profile('current', 4);
    const stale = profile('previous', 99);
    expect(resolveOwnedProfileUpdate('current-id', 'previous-id', 'current-id', current, stale)).toBeNull();
    expect(resolveOwnedProfileUpdate('current-id', 'current-id', 'current-id', current, { ...current, coins: 7 })?.coins).toBe(7);
  });

  it('uses the documented thresholds for the five-games quest', () => {
    expect(getAllFiveQuestCompletedMode(result({ type: 'sprint', guessedWords: 5 }))).toBeNull();
    expect(getAllFiveQuestCompletedMode(result({ type: 'sprint', guessedWords: 6 }))).toBe('sprint');
    expect(getAllFiveQuestCompletedMode(result({ type: 'anagram', guessedWords: 4 }))).toBeNull();
    expect(getAllFiveQuestCompletedMode(result({ type: 'anagram', guessedWords: 5 }))).toBe('anagram');
    expect(getAllFiveQuestCompletedMode(result({ type: 'wordle', won: false }))).toBeNull();
    expect(getAllFiveQuestCompletedMode(result({ type: 'wordle', won: true }))).toBe('wordle');
  });

  it('keeps composite quest progress under one database transaction', () => {
    const server = read('server/dailyQuestRepository.ts');
    expect(server).toContain('const progressResult = await transaction(async client =>');
    expect(server).toContain('const rowResult = await client.query<DailyQuestRow>');
    expect(server).toContain('getAllFiveQuestCompletedMode(input)');
  });

  it('binds async profile updates and registration intent to the current account', () => {
    const auth = read('hooks/useAuthProfile.ts');
    const app = read('AppV2.tsx');
    const overlay = read('components/auth/MagicLinkOverlay.tsx');
    expect(auth).toContain('setUserProfileForUser');
    expect(auth).toContain('if (!isCurrentProfileOwner(user.id)) return false');
    expect(auth).toContain('clearRegistrationIntent(); setAuthMode');
    expect(app).toContain('else clearRegistrationIntent(); openRegisterMode()');
    expect(app).toContain('onCloseLogin={closeAuthModal}');
    expect(overlay).toContain('clearRegistrationIntent();');
  });

  it('uses teacher-assigned words in the Kids custom pool and selected translations in Wordle', () => {
    const pools = read('hooks/useDictionaryPools.ts');
    const app = read('AppV2.tsx');
    expect(pools).toContain('toCustomEnrichedWords([...(userProfile.customDictionaryEn || []), ...assignedWords])');
    expect(pools).toContain("settings.dictionarySource === 'premium'");
    expect(app).toContain('getModeWords, getWordTranslation');
    expect(app).toContain('getModeWords, getWordTranslation, onRouteChange');
  });

  it('does not show a fake treat while a background reward is still pending', () => {
    const app = read('AppV2.tsx');
    expect(app).toContain('item: null, worldId: null, pending: true');
    expect(app).not.toContain('pickDailyQuestTreat(currentUserId, dailyQuest.questDate)');
  });
});
