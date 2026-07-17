import React from 'react';
import { AnagramGame } from '../AnagramGame';
import { SprintGame } from '../SprintGame';
import { TranslationChoiceGame } from '../TranslationChoiceGame';
import { MemoryGame } from '../MemoryGame';
import { HangmanGame } from '../HangmanGame';
import { GameModeShell } from './GameModeShell';
import { GUEST_PROFILE } from '../../constants/profileDefaults';
import { UserProfile, WordLength } from '../../types';
import { GameRewardInput } from '../../services/gamificationRules';
import { WordPracticeResult } from '../../services/gameSessionEngine';
import { isKidsMode } from '../../services/modeFlags';

interface ModeScreenProps {
  words: string[];
  wordLength: WordLength;
  dictionaryLabel?: string;
  dictionaryIcon?: string;
  rulesViewerKey?: string;
  userProfile?: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
  onWordPractice?: (word: string, result: WordPracticeResult) => void | Promise<void>;
  onBackHome: () => void;
  onDictionaryPeek?: () => boolean | Promise<boolean>;
}

const buildModeProfile = (userProfile: UserProfile | undefined, words: string[]): UserProfile => ({ ...(userProfile || GUEST_PROFILE), customDictionaryEn: words });
const KIDS_RULES = {
  anagrams: ['Собирайте слово из предложенных букв.', 'На каждое слово есть две попытки.', 'Кнопка «Не знаю» показывает ответ и добавляет слово для повторения.'],
  sprint: ['Выбирайте правильный перевод до окончания времени.', 'Звёзды начисляются за правильные ответы.', 'Ошибочные слова попадут в повторение.'],
  translation: ['Смотрите русское слово и выбирайте один из двух английских вариантов.', 'Неправильный вариант похож на правильный.', 'После ответа приложение покажет результат.'],
  memory: ['Открывайте карточки по две.', 'Найдите все пары «слово — перевод».', 'Завершите поле, чтобы получить результат.'],
  hangman: ['Угадывайте слово по одной букве.', 'Количество ошибок ограничено.', 'Победа сохраняет слово как выученное.'],
};
const PRACTICE_RULES = {
  anagrams: ['Собирайте слово из предложенных букв.', 'На каждое слово есть две попытки.', 'Кнопка «Не знаю» показывает ответ и добавляет слово для повторения.'],
  sprint: ['Выбирайте правильный перевод до окончания времени.', 'Ошибочные слова попадут в повторение.', 'Результат сохранится в статистике Practice.'],
  translation: KIDS_RULES.translation,
  memory: ['Открывайте карточки по две.', 'Найдите все пары «слово — перевод».', 'Результат сохранится в статистике Practice.'],
  hangman: ['Угадывайте слово по одной букве.', 'Количество ошибок ограничено.', 'Ошибочные слова попадут в повторение.'],
};
const rulesFor = (mode: keyof typeof KIDS_RULES, profile: UserProfile | undefined) => isKidsMode(profile || GUEST_PROFILE) ? KIDS_RULES[mode] : PRACTICE_RULES[mode];
const dictionaryPeekFor = (profile: UserProfile, onDictionaryPeek?: () => boolean | Promise<boolean>) => isKidsMode(profile) ? onDictionaryPeek : undefined;

export const AnagramsScreen: React.FC<ModeScreenProps> = ({ words, dictionaryLabel, dictionaryIcon, rulesViewerKey, userProfile, onGameReward, onWordPractice, onBackHome, onDictionaryPeek }) => {
  const profile = buildModeProfile(userProfile, words);
  return <GameModeShell gameId="anagrams" viewerKey={rulesViewerKey} title="Анаграммы" subtitle="Собери слово из букв" rules={rulesFor('anagrams', profile)} dictionaryWords={words} dictionaryLabel={dictionaryLabel} dictionaryIcon={dictionaryIcon} onBackHome={onBackHome} onDictionaryPeek={dictionaryPeekFor(profile, onDictionaryPeek)}><AnagramGame userProfile={profile} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={onBackHome} /></GameModeShell>;
};

export const SprintScreen: React.FC<ModeScreenProps> = ({ words, dictionaryLabel, dictionaryIcon, rulesViewerKey, userProfile, onGameReward, onWordPractice, onBackHome, onDictionaryPeek }) => {
  const profile = buildModeProfile(userProfile, words);
  return <GameModeShell gameId="sprint" viewerKey={rulesViewerKey} title="Спринт" subtitle="Быстрый режим" rules={rulesFor('sprint', profile)} dictionaryWords={words} dictionaryLabel={dictionaryLabel} dictionaryIcon={dictionaryIcon} onBackHome={onBackHome} onDictionaryPeek={dictionaryPeekFor(profile, onDictionaryPeek)}><SprintGame userProfile={profile} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={onBackHome} /></GameModeShell>;
};

export const TranslationChoiceScreen: React.FC<ModeScreenProps> = ({ words, dictionaryLabel, dictionaryIcon, rulesViewerKey, userProfile, onGameReward, onWordPractice, onBackHome, onDictionaryPeek }) => {
  const profile = buildModeProfile(userProfile, words);
  return <GameModeShell gameId="translation" viewerKey={rulesViewerKey} title="1 из 2" subtitle="Выбор перевода" rules={rulesFor('translation', profile)} dictionaryWords={words} dictionaryLabel={dictionaryLabel} dictionaryIcon={dictionaryIcon} onBackHome={onBackHome} onDictionaryPeek={dictionaryPeekFor(profile, onDictionaryPeek)}><TranslationChoiceGame userProfile={profile} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={onBackHome} /></GameModeShell>;
};

export const MemoryScreen: React.FC<ModeScreenProps> = ({ words, dictionaryLabel, dictionaryIcon, rulesViewerKey, userProfile, onGameReward, onWordPractice, onBackHome, onDictionaryPeek }) => {
  const profile = buildModeProfile(userProfile, words);
  return <GameModeShell gameId="memory" viewerKey={rulesViewerKey} title="Память" subtitle="Найди пары" rules={rulesFor('memory', profile)} dictionaryWords={words} dictionaryLabel={dictionaryLabel} dictionaryIcon={dictionaryIcon} onBackHome={onBackHome} onDictionaryPeek={dictionaryPeekFor(profile, onDictionaryPeek)}><MemoryGame userProfile={profile} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={onBackHome} /></GameModeShell>;
};

export const HangmanScreen: React.FC<ModeScreenProps> = ({ words, wordLength, dictionaryLabel, dictionaryIcon, rulesViewerKey, userProfile, onGameReward, onWordPractice, onBackHome, onDictionaryPeek }) => {
  const profile = buildModeProfile(userProfile, words);
  return <GameModeShell gameId="hangman" viewerKey={rulesViewerKey} title="Виселица" subtitle={`Угадай по буквам · ${wordLength} букв`} rules={rulesFor('hangman', profile)} dictionaryWords={words} dictionaryLabel={dictionaryLabel} dictionaryIcon={dictionaryIcon} wordLength={wordLength} onBackHome={onBackHome} onDictionaryPeek={dictionaryPeekFor(profile, onDictionaryPeek)}><HangmanGame userProfile={profile} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={onBackHome} /></GameModeShell>;
};