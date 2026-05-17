import { UserProfile } from '../types';

export const GUEST_PROFILE: UserProfile = {
  username: 'Гость',
  customDictionaryEn: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: {
    name: 'Персонаж',
    type: 'Puppy',
    level: 1,
    mood: 'calm',
    xp: 0,
    moodScore: 45,
    stage: 'stage_1',
    characterOnboarded: true,
    hunger: 45,
    energy: 45,
    equippedAccessories: [],
  },
  coins: 0,
  inventory: [],
};