import React from 'react';
import { AnagramGame } from '../AnagramGame';
import { SprintGame } from '../SprintGame';
import { MemoryGame } from '../MemoryGame';
import { HangmanGame } from '../HangmanGame';
import { GameModeShell } from './GameModeShell';
import { GUEST_PROFILE } from '../../constants/profileDefaults';
import { UserProfile, WordLength } from '../../types';
import { GameRewardInput } from '../../services/gamificationRules';
import { WordPracticeResult } from '../../services/gameSessionEngine';

interface ModeScreenProps {
  words: string[];
  wordLength: WordLength;
  userProfile?: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
  onWordPractice?: (word: string, result: WordPracticeResult) => void | Promise<void>;
  onBackHome: () => void;
}

const buildModeProfile = (userProfile: UserProfile | undefined, words: string[]): UserProfile => ({
  ...(userProfile || GUEST_PROFILE),
  customDictionaryEn: words,
});
const ownDictionary = (userProfile?: UserProfile): string[] => userProfile?.customDictionaryEn || [];

const MODE_RULES = {
  anagrams: [
    'Собирайте слово из перемешанных букв.',
    'За каждое угаданное слово начисляется опыт.',
    'За каждые 15 угаданных слов вы получаете 1 монету.',
    'Кнопка «Не знаю» добавляет слово для повторения и снимает 1 балл.',
    'Слова, в которых были ошибки, будут встречаться чаще до правильного ответа.',
  ],
  sprint: [
    'Выбирайте правильные ответы как можно быстрее.',
    'Опыт зависит от количества правильных ответов.',
    'Монеты начисляются за серию правильных ответов.',
    'Ошибочные слова будут встречаться чаще до правильного ответа.',
  ],
  memory: [
    'Открывайте карточки и находите пары слово–перевод.',
    'Победа в Памяти приносит больше опыта: лучше результат — больше награда.',
    'Игра тренирует узнавание слова и перевод, а не только скорость.',
  ],
  hangman: [
    'Угадывайте слово по буквам до окончания попыток.',
    'Победа приносит больше опыта, но и завершённая попытка даёт немного опыта.',
    'Ошибки не отнимают опыт, монеты или настроение.',
  ],
};

export const AnagramsScreen: React.FC<ModeScreenProps> = ({ words, wordLength, userProfile, onGameReward, onWordPractice, onBackHome }) => (
  <GameModeShell title="Анаграммы" subtitle={`Собери слово · ${wordLength} букв`} rules={MODE_RULES.anagrams} dictionaryWords={ownDictionary(userProfile)} wordLength={wordLength} onBackHome={onBackHome}>
    <AnagramGame userProfile={buildModeProfile(userProfile, words)} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={onBackHome} />
  </GameModeShell>
);

export const SprintScreen: React.FC<ModeScreenProps> = ({ words, wordLength, userProfile, onGameReward, onWordPractice, onBackHome }) => (
  <GameModeShell title="Спринт" subtitle={`Быстрый режим · ${wordLength} букв`} rules={MODE_RULES.sprint} dictionaryWords={ownDictionary(userProfile)} wordLength={wordLength} onBackHome={onBackHome}>
    <SprintGame userProfile={buildModeProfile(userProfile, words)} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={onBackHome} />
  </GameModeShell>
);

export const MemoryScreen: React.FC<ModeScreenProps> = ({ words, wordLength, userProfile, onGameReward, onBackHome }) => (
  <GameModeShell title="Память" subtitle={`Найди пары · ${wordLength} букв`} rules={MODE_RULES.memory} dictionaryWords={ownDictionary(userProfile)} wordLength={wordLength} onBackHome={onBackHome}>
    <MemoryGame userProfile={buildModeProfile(userProfile, words)} onGameReward={onGameReward} onBack={onBackHome} />
  </GameModeShell>
);

export const HangmanScreen: React.FC<ModeScreenProps> = ({ words, wordLength, userProfile, onGameReward, onWordPractice, onBackHome }) => (
  <GameModeShell title="Виселица" subtitle={`Угадай по буквам · ${wordLength} букв`} rules={MODE_RULES.hangman} dictionaryWords={ownDictionary(userProfile)} wordLength={wordLength} onBackHome={onBackHome}>
    <HangmanGame userProfile={buildModeProfile(userProfile, words)} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={onBackHome} />
  </GameModeShell>
);
