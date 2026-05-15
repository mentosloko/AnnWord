import { IslandDefinition, PetArchetype } from './worldTypes';

export const STARTER_PET_ARCHETYPES: PetArchetype[] = [
  { id: 'owl', displayName: 'Сова', personality: 'smart', starter: true },
  { id: 'fox', displayName: 'Лисёнок', personality: 'tricky', starter: true },
  { id: 'dino', displayName: 'Динозаврик', personality: 'strong', starter: true },
];

export const EGG_HATCH_WORDS_REQUIRED = 5;

export const ISLANDS: IslandDefinition[] = [
  {
    id: 'forest_a1',
    title: 'Лес A1',
    difficulty: 'A1',
    stickerId: 'forest_a1_sticker',
    wordsRequiredForSticker: 10,
  },
  {
    id: 'jungle_a2',
    title: 'Джунгли A2',
    difficulty: 'A2',
    stickerId: 'jungle_a2_sticker',
    wordsRequiredForSticker: 10,
  },
  {
    id: 'mountain_b1',
    title: 'Горный пик B1',
    difficulty: 'B1',
    stickerId: 'mountain_b1_sticker',
    wordsRequiredForSticker: 10,
  },
];

export const PET_TAP_PHRASES = [
  'I love learning!',
  'You are a star!',
  'Give me more words!',
  'Great job!',
  'More words, please!',
];
