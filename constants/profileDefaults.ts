import { UserProfile } from '../types';

export const GUEST_PROFILE: UserProfile = {
  username: 'Guest',
  customDictionaryEn: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} },
  pet: {
    name: 'Щенок',
    type: 'Puppy',
    level: 1,
    mood: 'happy',
    xp: 0,
    moodScore: 60,
    stage: 'stage_1',
    characterOnboarded: true,
    hunger: 60,
    energy: 60,
    equippedAccessories: [],
  },
  coins: 5,
  inventory: [],
};
