import React, { useCallback, useMemo, useRef, useState } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { buildPlayableGameDictionary, pickAdaptiveSessionWord, updateReviewPriorities, WordPracticeResult } from '../services/gameSessionEngine';
import { motion } from 'motion/react';
import { GameResultOverlay } from './GameResultOverlay';
import { applyGameRewardToCharacter, calculateGameReward, GameRewardInput } from '../services/gamificationRules';

interface TranslationChoiceGameProps { onBack: () => void; userProfile: UserProfile; onGameReward: (input: GameRewardInput) => void | Promise<void>; onWordPractice?: (word: string, result: WordPracticeResult) => void | Promise<void>; }
interface Question { word: EnrichedWord; options: string[]; correct: string; wrong: string; }
export const buildTranslationChoiceDictionary = (customDictionaryEn: string[] = [], fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN): EnrichedWord[] => buildPlayableGameDictionary(customDictionaryEn, fallbackDictionary);
const LETTER_SWAP: Record<string, string[]> = { A: ['U', 'O', 'E'], E: ['A', 'I'], I: ['E', 'Y'], O: ['A', 'U'], U: ['A', 'O'], Y: ['I'], L: ['R'], R: ['L'], M: ['N'], N: ['M'], T: ['D'], D: ['T'], C: ['K'], K: ['C'], S: ['Z'], Z: ['S'], P: ['B'], B: ['P'], G: ['K'], V: ['W'], W: ['V'] };
const distance = (a: string, b: string) => {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => Array.from({ length: b.length + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0));
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
};
const mutateWord = (word: string): string => {
  const letters = word.toUpperCase().split('');
  const indexes = letters.map((_, index) => index).filter(index => index > 0 && index < letters.length - 1);
  const candidates = indexes.length ? indexes : letters.map((_, index) => index);
  const index = candidates[Math.floor(Math.random() * candidates.length)] || 0;
  const replacements = LETTER_SWAP[letters[index]] || ['A', 'E', 'I', 'O', 'U'].filter(letter => letter !== letters[index]);
  letters[index] = replacements[Math.floor(Math.random() * replacements.length)] || 'A';
  const mutated = letters.join('');
  return mutated === word ? word.slice(0, -1) + (word.endsWith('E') ? 'A' : 'E') : mutated;
};
const makeWrongOption = (word: string, pool: EnrichedWord[]): string => {
  const similar = pool
    .map(entry => entry.word)
    .filter(candidate => candidate !== word && candidate.length === word.length)
    .map(candidate => ({ candidate, d: distance(word, candidate) }))
    .filter(item => item.d > 0 && item.d <= 2)
    .sort((a, b) => a.d - b.d || a.candidate.localeCompare(b.candidate))[0]?.candidate;
  return similar || mutateWord(word);
};
const makeQuestion = (pool: EnrichedWord[], previous?: string | null, reviewPriorities: Record<string, number> = {}): Question | null => {
  if (!pool.length) return null;
  const word = pickAdaptiveSessionWord('translation', pool, reviewPriorities, previous) || pool[Math.floor(Math.random() * pool.length)];
  const wrong = makeWrongOption(word.word, pool);
  const options = Math.random() < 0.5 ? [word.word, wrong] : [wrong, word.word];
  return { word, correct: word.word, wrong, options };
};

export const TranslationChoiceGame: React.FC<TranslationChoiceGameProps> = ({ onBack, userProfile, onGameReward, onWordPractice }) => {
  const dictionary = useMemo(() => buildTranslationChoiceDictionary(userProfile.customDictionaryEn), [userProfile.customDictionaryEn]);
  const [reviewPriorities, setReviewPriorities] = useState<Record<string, number>>({ ...(userProfile.stats.wordsToReview || {}) });
  const [question, setQuestion] = useState<Question | null>(() => makeQuestion(dictionary, null, userProfile.stats.wordsToReview || {}));
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const rewardAppliedRef = useRef(false);
  const finish = () => setFinished(true);
  const next = useCallback((previous?: string) => { setQuestion(makeQuestion(dictionary, previous, reviewPriorities)); setFeedback(null); setSelected(null); }, [dictionary, reviewPriorities]);
  const registerPractice = (word: string, result: WordPracticeResult) => { setReviewPriorities(prev => updateReviewPriorities(prev, word, result)); void Promise.resolve(onWordPractice?.(word, result)).catch(error => console.error('Failed to save translation choice practice', error)); };
  const choose = (option: string) => {
    if (!question || feedback || finished) return;
    const correct = option === question.correct;
    setSelected(option); setFeedback(correct ? 'correct' : 'wrong'); setAnswered(value => value + 1); if (correct) setScore(value => value + 1); registerPractice(question.correct, correct ? 'mastered' : 'failed');
    window.setTimeout(() => { if (answered + 1 >= 10) finish(); else next(question.correct); }, correct ? 650 : 950);
  };
  const restart = () => { rewardAppliedRef.current = false; setScore(0); setAnswered(0); setFinished(false); next(); };
  const reward = calculateGameReward({ type: 'translation', guessedWords: score });
  const progress = applyGameRewardToCharacter(userProfile.pet, reward);
  if (finished && !rewardAppliedRef.current) { rewardAppliedRef.current = true; void onGameReward({ type: 'translation', guessedWords: score }); }
  if (dictionary.length < 1 || !question) return <div className="flex w-full max-w-md flex-col items-center justify-center rounded-3xl bg-white p-8 text-center shadow-xl"><div className="mb-4 text-6xl">📚</div><h2 className="mb-2 text-2xl font-bold">Нет доступных слов</h2><p className="mb-6 text-gray-500">Для этой игры нужны слова с русским переводом.</p><button onClick={onBack} className="rounded-lg bg-indigo-600 px-6 py-2 font-bold text-white">Назад</button></div>;
  return <div className="mx-auto flex w-full max-w-xl flex-col rounded-3xl bg-white p-4 shadow-xl sm:p-6"><div className="mb-5 flex items-center justify-between gap-3"><button onClick={onBack} className="rounded-xl bg-indigo-50 px-3 py-2 text-sm font-black text-indigo-700">← Меню</button><div className="rounded-full bg-indigo-50 px-3 py-2 text-sm font-black text-indigo-700">{answered}/10 · ⭐ {score}</div></div><div className="text-center"><div className="text-xs font-black uppercase tracking-widest text-indigo-300">Выбери английский перевод</div><div className="mt-3 rounded-[2rem] bg-indigo-50 px-5 py-8 text-3xl font-black text-indigo-950">{question.word.translation}</div><p className="mt-3 text-xs font-bold text-gray-500">Неправильный вариант специально похож на правильный.</p></div><div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">{question.options.map(option => <motion.button key={option} whileTap={{ scale: 0.98 }} disabled={Boolean(feedback)} onClick={() => choose(option)} className={`rounded-3xl border-2 px-5 py-5 text-3xl font-black tracking-wide transition disabled:opacity-100 ${feedback && option === question.correct ? 'border-green-300 bg-green-50 text-green-700' : feedback && selected === option && option !== question.correct ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-indigo-100 bg-white text-indigo-900 hover:bg-indigo-50'}`}>{option}</motion.button>)}</div>{feedback && <div aria-live="polite" className={`mt-4 rounded-2xl px-4 py-3 text-center text-sm font-black ${feedback === 'correct' ? 'bg-green-50 text-green-700' : 'bg-rose-50 text-rose-700'}`}>{feedback === 'correct' ? 'Верно!' : `Нужно: ${question.correct}`}</div>}<GameResultOverlay isOpen={finished} status="completed" title="Раунд завершён" subtitle={`Правильных ответов: ${score} из ${answered}`} emoji="🎯" pet={progress.pet} xpGained={reward.xp} coinsGained={reward.coins} primaryLabel="Играть снова" secondaryLabel="В меню" onPrimary={restart} onSecondary={onBack} /></div>;
};
