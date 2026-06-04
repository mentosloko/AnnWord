import { describe, expect, it } from 'vitest';
import { preserveEstablishedAccountAccess } from '../services/profileAccessState';
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

    expect(preserveEstablishedAccountAccess(previous, fullServerProfile)).toBe(fullServerProfile);
  });
});
