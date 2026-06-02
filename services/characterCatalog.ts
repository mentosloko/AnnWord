import { PetState } from '../types';

export interface StarterCharacter {
  type: string;
  title: string;
  emoji: string;
  description: string;
  defaultName: string;
}

export const STARTER_CHARACTERS: StarterCharacter[] = [
  {
    type: 'Puppy',
    title: 'Щенок',
    emoji: '🐶',
    description: 'Добрый друг, который радуется новым словам.',
    defaultName: 'Бадди',
  },
  {
    type: 'Dragon',
    title: 'Дракончик',
    emoji: '🐲',
    description: 'Любит приключения и растёт вместе с твоими победами.',
    defaultName: 'Искорка',
  },
  {
    type: 'RoboCat',
    title: 'Робокот',
    emoji: '🤖',
    description: 'Умный помощник из будущего, который становится круче с каждым новым опытом.',
    defaultName: 'Байт',
  },
];

export const createStarterCharacter = (type: string, name: string): PetState => {
  const character = STARTER_CHARACTERS.find(entry => entry.type === type) || STARTER_CHARACTERS[0];
  const cleanName = name.trim() || character.defaultName;

  return {
    name: cleanName,
    type: character.type,
    level: 1,
    mood: 'happy',
    xp: 0,
    moodScore: 60,
    stage: 'stage_1',
    characterOnboarded: true,
    hunger: 60,
    energy: 60,
    equippedAccessories: [],
  };
};