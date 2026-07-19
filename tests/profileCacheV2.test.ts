import { afterEach, describe, expect, it } from 'vitest';
import { profileCache } from '../services/profileCache';
import type { UserProfile } from '../types';

const fullProfile = (): UserProfile => ({
  username: 'parent@example.ru',
  role: 'parent',
  accountMode: 'parent',
  subscriptionTier: 'premium',
  premiumExpiresAt: '2027-01-01T00:00:00.000Z',
  childDisplayName: 'Катя',
  childShareCode: 'KATYA1',
  childSlotsLimit: 1,
  featureFlags: { adultRoom: true, premiumDictionaries: true },
  customDictionaryEn: ['APPLE'],
  assignedWords: ['SCHOOL'],
  dictionaryCollections: [{ id: 'collection-1', title: 'Школа', source: 'manual', words: ['SCHOOL'], createdAt: '2026-07-19T10:00:00.000Z' }],
  managedLearners: [{ id: 'child-1', name: 'Катя', stats: { gamesPlayed: 2, gamesWon: 1, wordsGuessed: {} }, assignedWords: ['SCHOOL'], weeklyAccuracy: 50 }],
  weeklyReportEmail: 'parent@example.ru',
  stats: { gamesPlayed: 4, gamesWon: 3, wordsGuessed: { APPLE: 1 } },
  pet: { name: 'Щенок', type: 'Puppy', level: 2, mood: 'happy', xp: 100, equippedAccessories: [] },
  coins: 25,
  inventory: [],
});

afterEach(() => {
  profileCache.clear();
  window.localStorage.clear();
});

describe('profileCache v2', () => {
  it('preserves family, Premium, dictionary and report fields', () => {
    profileCache.write(fullProfile(), 'user-1');

    const snapshot = profileCache.readSnapshot();

    expect(snapshot?.userId).toBe('user-1');
    expect(snapshot?.profile).toMatchObject({
      role: 'parent',
      accountMode: 'parent',
      subscriptionTier: 'premium',
      childDisplayName: 'Катя',
      childShareCode: 'KATYA1',
      weeklyReportEmail: 'parent@example.ru',
      assignedWords: ['SCHOOL'],
    });
    expect(snapshot?.profile.dictionaryCollections).toHaveLength(1);
    expect(snapshot?.profile.managedLearners).toHaveLength(1);
    expect(profileCache.getFreshness()).toBe('fresh');
  });

  it('marks a persisted snapshot as cached before server confirmation', () => {
    window.localStorage.setItem('annword_cached_profile_v2', JSON.stringify({
      version: 2,
      savedAt: Date.now(),
      userId: 'user-1',
      profile: fullProfile(),
    }));

    expect(profileCache.readSnapshot()?.profile.childDisplayName).toBe('Катя');
    expect(profileCache.getFreshness()).toBe('cached');
  });

  it('removes the incomplete legacy cache key', () => {
    window.localStorage.setItem('annword_cached_profile_v1', JSON.stringify({ version: 1, profile: fullProfile() }));

    profileCache.readSnapshot();

    expect(window.localStorage.getItem('annword_cached_profile_v1')).toBeNull();
  });
});
