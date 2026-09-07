import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { activeWordSourceFromSettings, activeWordSourceKey, applyActiveWordSourceToSettings, normalizeActiveWordSource } from '../services/activeWordSource';
import type { GameSettings } from '../types';

const settings: GameSettings = {
  wordLength: 5,
  useCustomDictionary: false,
  dictionarySource: 'builtin',
  difficulty: 'ALL',
  username: 'Test',
};

describe('canonical active word source', () => {
  it('round-trips multiple Spotlight modules through the canonical model', () => {
    const active = activeWordSourceFromSettings({
      ...settings,
      dictionarySource: 'premium',
      activePremiumDictionaryId: 'premium_spotlight_school',
      activeSpotlightGrade: 4,
      activeSpotlightSectionId: 'module-2',
      activeSpotlightSectionIds: ['module-2', 'module-1', 'module-2'],
    });
    expect(active).toEqual({
      source: 'premium',
      difficulty: 'ALL',
      premiumDictionaryId: 'premium_spotlight_school',
      spotlightGrade: 4,
      spotlightSectionId: 'module-1',
      spotlightSectionIds: ['module-1', 'module-2'],
      updatedAt: undefined,
    });
    expect(applyActiveWordSourceToSettings(settings, active)).toMatchObject({
      dictionarySource: 'premium',
      useCustomDictionary: false,
      activePremiumDictionaryId: 'premium_spotlight_school',
      activeSpotlightGrade: 4,
      activeSpotlightSectionId: 'module-1',
      activeSpotlightSectionIds: ['module-1', 'module-2'],
    });
  });

  it('migrates a legacy single Spotlight module to the plural representation', () => {
    expect(normalizeActiveWordSource({
      source: 'premium',
      difficulty: 'ALL',
      premiumDictionaryId: 'premium_spotlight_school',
      spotlightGrade: 5,
      spotlightSectionId: 'module-3',
    })).toMatchObject({
      spotlightSectionId: 'module-3',
      spotlightSectionIds: ['module-3'],
    });
  });

  it('treats all-class selection as exclusive and makes module order irrelevant to the source key', () => {
    const base = {
      source: 'premium',
      difficulty: 'ALL',
      premiumDictionaryId: 'premium_spotlight_school',
      spotlightGrade: 6,
    } as const;
    expect(normalizeActiveWordSource({ ...base, spotlightSectionIds: ['module-1', 'all', 'module-2'] }).spotlightSectionIds).toEqual(['all']);
    expect(activeWordSourceKey({ ...base, spotlightSectionIds: ['module-3', 'module-1', 'module-2'] }))
      .toBe(activeWordSourceKey({ ...base, spotlightSectionIds: ['module-2', 'module-3', 'module-1'] }));
  });

  it('clears premium-only metadata when custom becomes active', () => {
    const next = applyActiveWordSourceToSettings({
      ...settings,
      dictionarySource: 'premium',
      activePremiumDictionaryId: 'premium_spotlight_school',
      activeSpotlightGrade: 3,
      activeSpotlightSectionId: 'module-1',
      activeSpotlightSectionIds: ['module-1', 'module-2'],
    }, { source: 'custom', difficulty: 'ALL' });
    expect(next).toMatchObject({ dictionarySource: 'custom', useCustomDictionary: true, difficulty: 'ALL' });
    expect(next.activePremiumDictionaryId).toBeUndefined();
    expect(next.activeSpotlightGrade).toBeUndefined();
    expect(next.activeSpotlightSectionId).toBeUndefined();
    expect(next.activeSpotlightSectionIds).toBeUndefined();
  });

  it('sanitizes malformed server values instead of making games unusable', () => {
    expect(normalizeActiveWordSource({ source: 'other', difficulty: 'Z9' })).toEqual({ source: 'builtin', difficulty: 'ALL', updatedAt: undefined });
  });

  it('keeps dictionary selection out of localStorage and commits UI draft only on Done', () => {
    const authHook = fs.readFileSync('hooks/useAuthProfile.ts', 'utf8');
    const screen = fs.readFileSync('components/screens/DictionarySettingsScreen.tsx', 'utf8');
    const appScreens = fs.readFileSync('components/AppScreens.tsx', 'utf8');
    expect(authHook).toContain("Partial<Pick<GameSettings, 'wordLength'>>");
    expect(authHook).toContain('applyActiveWordSourceToSettings');
    expect(authHook).not.toContain('activePremiumDictionaryId: settings.activePremiumDictionaryId');
    expect(screen).toContain('const [draftSettings, setDraftSettings]');
    expect(screen).toContain('onCommitSettings: (settings: GameSettings) => Promise<void>');
    expect(screen).toContain('Сохраните выбор, чтобы применить его к играм.');
    expect(screen).not.toContain('onSettingsChange: (settings: GameSettings) => void');
    expect(appScreens).toContain("profileApiService.updateActiveWordSource(activeWordSourceFromSettings(draftSettings))");
    expect(appScreens).toContain('dispatchOwnedProfileUpdate(ownerId, profile)');
  });

  it('persists source and revision on the server profile', () => {
    const migration = fs.readFileSync('db/yandex/20260825_uat_dictionary_active_word_source.sql', 'utf8');
    const routes = fs.readFileSync('server/routes/profileRoutes.ts', 'utf8');
    const repository = fs.readFileSync('server/profileRepository.ts', 'utf8');
    expect(migration).toContain('active_word_source jsonb');
    expect(migration).toContain('active_word_source_updated_at timestamptz');
    expect(routes).toContain('/active-word-source');
    expect(repository).toContain('active_word_source_updated_at = now()');
    expect(repository).toContain('returning ${PROFILE_COLUMNS}');
  });
});
