import { describe, expect, it } from 'vitest';
import { mergeProfileUpdateForOwner, preserveEstablishedAccountAccess } from '../services/profileAccessState';
import { UserProfile } from '../types';

const profile = (overrides: Partial<UserProfile> = {}): UserProfile => ({
  username: 'anna.a.manto',
  role: 'parent',
  accountMode: 'parent',
  subscriptionTier: 'premium',
  premiumExpiresAt: '2026-07-04T17:11:44.961Z',
  childDisplayName: 'Анна',
  childShareCode: 'ABC12345',
  childSlotsLimit: 1,
  featureFlags: { adultRoom: true, premiumDictionaries: true },
  activeWordSource: { source: 'builtin', difficulty: 'ALL', updatedAt: '2026-08-25T10:00:00.000Z' },
  dictionaryCollections: [],
  customDictionaryEn: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: { name: 'Щенок', type: 'Puppy', level: 1, mood: 'happy', xp: 0, equippedAccessories: [] },
  coins: 0,
  inventory: [],
  ...overrides,
});

describe('preserveEstablishedAccountAccess', () => {
  it('keeps onboarding and Premium fields when a gameplay RPC returns a partial profile', () => {
    const previous = profile();
    const partialUpdate = profile({
      role: 'user',
      accountMode: undefined,
      subscriptionTier: 'free',
      premiumExpiresAt: undefined,
      childDisplayName: undefined,
      childShareCode: undefined,
      featureFlags: {},
      coins: 7,
    });

    const merged = preserveEstablishedAccountAccess(previous, partialUpdate);

    expect(merged).toMatchObject({
      role: 'parent',
      accountMode: 'parent',
      subscriptionTier: 'premium',
      premiumExpiresAt: previous.premiumExpiresAt,
      childDisplayName: 'Анна',
      childShareCode: 'ABC12345',
      featureFlags: { adultRoom: true, premiumDictionaries: true },
      coins: 7,
    });
  });

  it('allows a full server profile with accountMode to replace old access state', () => {
    const previous = profile();
    const fullServerProfile = profile({ accountMode: 'teacher', role: 'teacher', subscriptionTier: 'free' });

    expect(preserveEstablishedAccountAccess(previous, fullServerProfile)).toMatchObject({ accountMode: 'teacher', role: 'teacher', subscriptionTier: 'free' });
  });

  it('does not carry onboarding state between different accounts on the same device', () => {
    const previous = profile({ childDisplayName: 'Анна', childShareCode: 'ABC12345', pet: { ...profile().pet, characterOnboarded: true, name: 'Рэй' } });
    const newAccount = profile({ username: 'new-user', childDisplayName: undefined, childShareCode: undefined, pet: { ...profile().pet, characterOnboarded: false, name: 'Щенок' } });
    const merged = mergeProfileUpdateForOwner('old-user-id', 'new-user-id', previous, newAccount);
    expect(merged.childDisplayName).toBeUndefined();
    expect(merged.childShareCode).toBeUndefined();
    expect(merged.pet.characterOnboarded).toBe(false);
  });

  it('never sends a completed character back to onboarding when an older response arrives', () => {
    const previous = profile({ pet: { ...profile().pet, characterOnboarded: true, name: 'Рэй' } });
    const stale = profile({ pet: { ...profile().pet, characterOnboarded: false, name: 'Щенок' }, coins: 4 });
    const merged = preserveEstablishedAccountAccess(previous, stale);
    expect(merged.pet.characterOnboarded).toBe(true);
    expect(merged.coins).toBe(4);
  });

  it('keeps the newest rewarded room when a stale game response arrives later', () => {
    const previous = profile({ pet: { ...profile().pet, activeWorldId: 'theatre', activeWorldDate: '2026-08-05' } });
    const stale = profile({ pet: { ...profile().pet, activeWorldId: 'default_room', activeWorldDate: undefined } });
    expect(preserveEstablishedAccountAccess(previous, stale).pet).toMatchObject({ activeWorldId: 'theatre', activeWorldDate: '2026-08-05' });
  });

  it('keeps a newer active word source when an older hydration response arrives later', () => {
    const previous = profile({
      activeWordSource: { source: 'premium', difficulty: 'ALL', premiumDictionaryId: 'kids_animals', updatedAt: '2026-08-25T10:02:00.000Z' },
    });
    const stale = profile({
      activeWordSource: { source: 'builtin', difficulty: 'ALL', updatedAt: '2026-08-25T10:01:00.000Z' },
      coins: 12,
    });
    const merged = preserveEstablishedAccountAccess(previous, stale);
    expect(merged.activeWordSource).toEqual(previous.activeWordSource);
    expect(merged.coins).toBe(12);
  });

  it('accepts a newer server word source selection', () => {
    const previous = profile({ activeWordSource: { source: 'builtin', difficulty: 'ALL', updatedAt: '2026-08-25T10:01:00.000Z' } });
    const newer = profile({ activeWordSource: { source: 'custom', difficulty: 'ALL', updatedAt: '2026-08-25T10:03:00.000Z' } });
    expect(preserveEstablishedAccountAccess(previous, newer).activeWordSource).toEqual(newer.activeWordSource);
  });
});
