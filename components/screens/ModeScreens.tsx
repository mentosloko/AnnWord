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

interface ModeScreenProps { words: string[]; wordLength: WordLength; dictionaryLabel?: string; dictionaryIcon?: string; userProfile?: UserProfile; onGameReward: (input: GameRewardInput) => void | Promise<void>; onWordPractice?: (word: string, result: WordPracticeResult) => void | Promise<void>; onBackHome: () => void; onDictionaryPeek?: () => boolean | Promise<boolean>; }
const buildModeProfile = (userProfile: UserProfile | undefined, words: string[]): UserProfile => ({ ...(userProfile || GUEST_PROFILE), customDictionaryEn: words });
const MODE_RULES = {
  anagrams: ['Собирайте слово из букв.', '1 монета за каждые 10 угаданных слов.', 'Кнопка «Не знаю» показывает ответ и добавляет слово для повторения.'],
  sprint: ['Звёзды — это правильные ответы.', '6 звёзд дают 1 монету, 10 и больше — 3 монеты.'],
  translation: ['Смотрите русское слово и выбирайте английский перевод.', 'Неправильный вариант похож на правильный: tall/toll, smart/smurt.', 'Раунд состоит из 10 вопросов.'],
  memory: ['Открывайте карточки и находите пары слово–перевод.', 'Завершите игру, чтобы получить опыт.'],
  hangman: ['Угадывайте слово по буквам.', 'Победа приносит больше опыта.'],
};
export const AnagramsScreen: React.FC<ModeScreenProps> = ({ words, wordLength, dictionaryLabel, dictionaryIcon, userProfile, onGameReward, onWordPractice, onBackHome, onDictionaryPeek }) => <GameModeShell title="Анаграммы" subtitle={`Собери слово · ${wordLength} букв`} rules={MODE_RULES.anagrams} dictionaryWords={words} dictionaryLabel={dictionaryLabel} dictionaryIcon={dictionaryIcon} wordLength={wordLength} onBackHome={onBackHome} onDictionaryPeek={onDictionaryPeek}><AnagramGame userProfile={buildModeProfile(userProfile, words)} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={onBackHome} /></GameModeShell>;
export const SprintScreen: React.FC<ModeScreenProps> = ({ words, wordLength, dictionaryLabel, dictionaryIcon, userProfile, onGameReward, onWordPractice, onBackHome, onDictionaryPeek }) => <GameModeShell title="Спринт" subtitle={`Быстрый режим · ${wordLength} букв`} rules={MODE_RULES.sprint} dictionaryWords={words} dictionaryLabel={dictionaryLabel} dictionaryIcon={dictionaryIcon} wordLength={wordLength} onBackHome={onBackHome} onDictionaryPeek={onDictionaryPeek}><SprintGame userProfile={buildModeProfile(userProfile, words)} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={onBackHome} /></GameModeShell>;
export const TranslationChoiceScreen: React.FC<ModeScreenProps> = ({ words, wordLength, dictionaryLabel, dictionaryIcon, userProfile, onGameReward, onWordPractice, onBackHome, onDictionaryPeek }) => <GameModeShell title="Перевод" subtitle={`2 варианта · ${wordLength} букв`} rules={MODE_RULES.translation} dictionaryWords={words} dictionaryLabel={dictionaryLabel} dictionaryIcon={dictionaryIcon} wordLength={wordLength} onBackHome={onBackHome} onDictionaryPeek={onDictionaryPeek}><TranslationChoiceGame userProfile={buildModeProfile(userProfile, words)} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={onBackHome} /></GameModeShell>;
export const MemoryScreen: React.FC<ModeScreenProps> = ({ words, wordLength, dictionaryLabel, dictionaryIcon, userProfile, onGameReward, onBackHome, onDictionaryPeek }) => <GameModeShell title="Память" subtitle={`Найди пары · ${wordLength} букв`} rules={MODE_RULES.memory} dictionaryWords={words} dictionaryLabel={dictionaryLabel} dictionaryIcon={dictionaryIcon} wordLength={wordLength} onBackHome={onBackHome} onDictionaryPeek={onDictionaryPeek}><MemoryGame userProfile={buildModeProfile(userProfile, words)} onGameReward={onGameReward} onBack={onBackHome} /></GameModeShell>;
export const HangmanScreen: React.FC<ModeScreenProps> = ({ words, wordLength, dictionaryLabel, dictionaryIcon, userProfile, onGameReward, onWordPractice, onBackHome, onDictionaryPeek }) => <GameModeShell title="Виселица" subtitle={`Угадай по буквам · ${wordLength} букв`} rules={MODE_RULES.hangman} dictionaryWords={words} dictionaryLabel={dictionaryLabel} dictionaryIcon={dictionaryIcon} wordLength={wordLength} onBackHome={onBackHome} onDictionaryPeek={onDictionaryPeek}><HangmanGame userProfile={buildModeProfile(userProfile, words)} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={onBackHome} /></GameModeShell>;
