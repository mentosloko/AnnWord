import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { activeWordSourceFromSettings, applyActiveWordSourceToSettings, normalizeActiveWordSource } from '../services/activeWordSource';
import type { GameSettings } from '../types';

const settings: GameSettings = {
  wordLength: 5,
  useCustomDictionary: false,
  dictionarySource: 'builtin',
  difficulty: 'ALL',
  username: 'Test',
};

describe('canonical active word source', () => {
  it('round-trips premium dictionary metadata through the canonical model', () => {
    const active = activeWordSourceFromSettings({
      ...settings,
      dictionarySource: 'premium',
      activePremiumDictionaryId: 'kids_animals',
      activeSpotlightGrade: 4,
      activeSpotlightSectionId: 'module-2',
    });
    expect(active).toEqual({
      source: 'premium',
      difficulty: 'ALL',
      premiumDictionaryId: 'kids_animals',
      spotlightGrade: 4,
      spotlightSectionId: 'module-2',
      updatedAt: undefined,
    });
    expect(applyActiveWordSourceToSettings(settings, active)).toMatchObject({
      dictionarySource: 'premium',
      useCustomDictionary: false,
      activePremiumDictionaryId: 'kids_animals',
      activeSpotlightGrade: 4,
      activeSpotlightSectionId: 'module-2',
    });
  });

  it('clears premium-only metadata when custom becomes active', () => {
    const next = applyActiveWordSourceToSettings({
      ...settings,
      dictionarySource: 'premium',
      activePremiumDictionaryId: 'kids_animals',
      activeSpotlightGrade: 3,
      activeSpotlightSectionId: 'module-1',
    }, { source: 'custom', difficulty: 'ALL' });
    expect(next).toMatchObject({ dictionarySource: 'custom', useCustomDictionary: true, difficulty: 'ALL' });
    expect(next.activePremiumDictionaryId).toBeUndefined();
    expect(next.activeSpotlightGrade).toBeUndefined();
    expect(next.activeSpotlightSectionId).toBeUndefined();
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
