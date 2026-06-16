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
interface ModeScreenProps { words: string[]; wordLength: WordLength; dictionaryLabel?: string; dictionaryIcon?: string; userProfile?: UserProfile; onGameReward: (input: GameRewardInput) => void | Promise<void>; onWordPractice?: (word: string, result: WordPracticeResult) => void | Promise<void>; onBackHome: () => void; onDictionaryPeek?: () => boolean | Promise<boolean>; }
const buildModeProfile = (userProfile: UserProfile | undefined, words: string[]): UserProfile => ({ ...(userProfile || GUEST_PROFILE), customDictionaryEn: words });
const KIDS_RULES = {
  anagrams: ['Собирайте слово из букв.', '1 монета за каждые 10 угаданных слов.', 'Кнопка «Не знаю» показывает ответ и добавляет слово для повторения.'],
  sprint: ['Звёзды — это правильные ответы.', '6 звёзд дают 1 монету, 10 и больше — 3 монеты.'],
  translation: ['Смотрите русское слово и выбирайте 1 из 2 английских вариантов.', 'Неправильный вариант похож на правильный: tall/toll, smart/smurt.', 'После неверного ответа переход только по кнопке.'],
  memory: ['Открывайте карточки и находите пары слово–перевод.', 'Завершите игру, чтобы получить опыт.'],
  hangman: ['Угадывайте слово по буквам.', 'Победа приносит больше опыта.'],
};
const PRACTICE_RULES = {
  anagrams: ['Собирайте слово из букв.', 'Кнопка «Не знаю» показывает ответ и добавляет слово для повторения.', 'Результат сохраняется в статистику практики.'],
  sprint: ['Звёзды — это правильные ответы.', 'Слова после ошибок попадают в повторение.', 'Результат сохраняется в статистику практики.'],
  translation: KIDS_RULES.translation,
  memory: ['Открывайте карточки и находите пары слово–перевод.', 'Результат сохраняется в статистику практики.'],
  hangman: ['Угадывайте слово по буквам.', 'Ошибочные слова попадают в повторение.'],
};
const rulesFor = (mode: keyof typeof KIDS_RULES, profile: UserProfile | undefined) => isKidsMode(profile || GUEST_PROFILE) ? KIDS_RULES[mode] : PRACTICE_RULES[mode];
export const AnagramsScreen: React.FC<ModeScreenProps> = ({ words, wordLength, dictionaryLabel, dictionaryIcon, userProfile, onGameReward, onWordPractice, onBackHome, onDictionaryPeek }) => { const profile = buildModeProfile(userProfile, words); return <GameModeShell title="Анаграммы" subtitle={`Собери слово · ${wordLength} букв`} rules={rulesFor('anagrams', profile)} dictionaryWords={words} dictionaryLabel={dictionaryLabel} dictionaryIcon={dictionaryIcon} wordLength={wordLength} onBackHome={onBackHome} onDictionaryPeek={onDictionaryPeek}><AnagramGame userProfile={profile} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={onBackHome} /></GameModeShell>; };
export const SprintScreen: React.FC<ModeScreenProps> = ({ words, wordLength, dictionaryLabel, dictionaryIcon, userProfile, onGameReward, onWordPractice, onBackHome, onDictionaryPeek }) => { const profile = buildModeProfile(userProfile, words); return <GameModeShell title="Спринт" subtitle={`Быстрый режим · ${wordLength} букв`} rules={rulesFor('sprint', profile)} dictionaryWords={words} dictionaryLabel={dictionaryLabel} dictionaryIcon={dictionaryIcon} wordLength={wordLength} onBackHome={onBackHome} onDictionaryPeek={onDictionaryPeek}><SprintGame userProfile={profile} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={onBackHome} /></GameModeShell>; };
export const TranslationChoiceScreen: React.FC<ModeScreenProps> = ({ words, wordLength, dictionaryLabel, dictionaryIcon, userProfile, onGameReward, onWordPractice, onBackHome, onDictionaryPeek }) => { const profile = buildModeProfile(userProfile, words); return <GameModeShell title="1 из 2" subtitle={`выбор перевода · ${wordLength} букв`} rules={rulesFor('translation', profile)} dictionaryWords={words} dictionaryLabel={dictionaryLabel} dictionaryIcon={dictionaryIcon} wordLength={wordLength} onBackHome={onBackHome} onDictionaryPeek={onDictionaryPeek}><TranslationChoiceGame userProfile={profile} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={onBackHome} /></GameModeShell>; };
export const MemoryScreen: React.FC<ModeScreenProps> = ({ words, wordLength, dictionaryLabel, dictionaryIcon, userProfile, onGameReward, onBackHome, onDictionaryPeek }) => { const profile = buildModeProfile(userProfile, words); return <GameModeShell title="Память" subtitle={`Найди пары · ${wordLength} букв`} rules={rulesFor('memory', profile)} dictionaryWords={words} dictionaryLabel={dictionaryLabel} dictionaryIcon={dictionaryIcon} wordLength={wordLength} onBackHome={onBackHome} onDictionaryPeek={onDictionaryPeek}><MemoryGame userProfile={profile} onGameReward={onGameReward} onBack={onBackHome} /></GameModeShell>; };
export const HangmanScreen: React.FC<ModeScreenProps> = ({ words, wordLength, dictionaryLabel, dictionaryIcon, userProfile, onGameReward, onWordPractice, onBackHome, onDictionaryPeek }) => { const profile = buildModeProfile(userProfile, words); return <GameModeShell title="Виселица" subtitle={`Угадай по буквам · ${wordLength} букв`} rules={rulesFor('hangman', profile)} dictionaryWords={words} dictionaryLabel={dictionaryLabel} dictionaryIcon={dictionaryIcon} wordLength={wordLength} onBackHome={onBackHome} onDictionaryPeek={onDictionaryPeek}><HangmanGame userProfile={profile} onGameReward={onGameReward} onWordPractice={onWordPractice} onBack={onBackHome} /></GameModeShell>; };
