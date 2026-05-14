import { UserProfile } from '../types';

export const GUEST_PROFILE: UserProfile = {
  username: 'Guest',
  customDictionaryEn: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: {
    name: 'Owl',
    type: 'Owl',
    level: 1,
    mood: 'neutral',
    xp: 0,
    hunger: 100,
    energy: 100,
    equippedAccessories: [],
  },
  coins: 100,
  inventory: [],
};
