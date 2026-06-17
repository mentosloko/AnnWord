import React, { useCallback, useMemo, useRef, useState } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { applyGameRewardToCharacter, calculateGameReward, GameRewardInput } from '../services/gamificationRules';
import { buildPlayableGameDictionary, pickAdaptiveSessionWord, updateReviewPriorities, WordPracticeResult } from '../services/gameSessionEngine';
import { isKidsMode } from '../services/modeFlags';
import { GameResultOverlay } from './GameResultOverlay';

interface LetterSquareGameProps {
  onBack: () => void;
  userProfile: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
  onWordPractice?: (word: string, result: WordPracticeResult) => void | Promise<void>;
}

type Coord = { row: number; col: number };
interface LetterCell extends Coord { letter: string; }
interface LetterSquareRound { word: EnrichedWord; grid: LetterCell[][]; answerPath: Coord[]; }

const GRID_SIZE = 5;
const ROUND_LIMIT = 8;
const MIN_WORD_LENGTH = 4;
const MAX_WORD_LENGTH = 9;
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const buildLetterSquareDictionary = (customDictionaryEn: string[] = [], fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN): EnrichedWord[] =>
  buildPlayableGameDictionary(customDictionaryEn, fallbackDictionary)
    .map(entry => ({ ...entry, word: entry.word.toUpperCase() }))
    .filter(entry => /^[A-Z]+$/.test(entry.word) && entry.word.length >= MIN_WORD_LENGTH && entry.word.length <= MAX_WORD_LENGTH);

const keyFor = (coord: Coord) => `${coord.row}:${coord.col}`;
const sameCoord = (a: Coord, b: Coord) => a.row === b.row && a.col === b.col;
const areOrthogonalNeighbors = (a: Coord, b: Coord) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
const shuffle = <T,>(items: T[]): T[] => [...items].sort(() => Math.random() - 0.5);
const randomLetter = () => LETTERS[Math.floor(Math.random() * LETTERS.length)] || 'A';

const neighborsFor = (coord: Coord, size = GRID_SIZE): Coord[] => [
  { row: coord.row - 1, col: coord.col },
  { row: coord.row + 1, col: coord.col },
  { row: coord.row, col: coord.col - 1 },
  { row: coord.row, col: coord.col + 1 },
].filter(next => next.row >= 0 && next.row < size && next.col >= 0 && next.col < size);

const buildOrthogonalPath = (length: number, size = GRID_SIZE): Coord[] => {
  const cells = Array.from({ length: size * size }, (_, index) => ({ row: Math.floor(index / size), col: index % size }));
  for (let attempt = 0; attempt < 500; attempt++) {
    const path: Coord[] = [cells[Math.floor(Math.random() * cells.length)] || { row: 0, col: 0 }];
    const used = new Set<string>([keyFor(path[0])]);

    while (path.length < length) {
      const last = path[path.length - 1];
      const next = shuffle(neighborsFor(last, size)).find(candidate => !used.has(keyFor(candidate)));
      if (!next) break;
      path.push(next);
      used.add(keyFor(next));
    }

    if (path.length === length) return path;
  }

  return Array.from({ length }, (_, index) => ({ row: Math.floor(index / size), col: index % size }));
};

const makeRound = (pool: EnrichedWord[], previous?: string | null, reviewPriorities: Record<string, number> = {}): LetterSquareRound | null => {
  if (!pool.length) return null;
  const word = pickAdaptiveSessionWord('letterSquare', pool, reviewPriorities, previous) || pool[Math.floor(Math.random() * pool.length)];
  if (!word) return null;
  const answerPath = buildOrthogonalPath(word.word.length);
  const grid = Array.from({ length: GRID_SIZE }, (_, row) => Array.from({ length: GRID_SIZE }, (_, col): LetterCell => ({ row, col, letter: randomLetter() })));
  answerPath.forEach((coord, index) => { grid[coord.row][coord.col] = { ...coord, letter: word.word[index] || randomLetter() }; });
  return { word, grid, answerPath };
};

export const LetterSquareGame: React.FC<LetterSquareGameProps> = ({ onBack, userProfile, onGameReward, onWordPractice }) => {
  const dictionary = useMemo(() => buildLetterSquareDictionary(userProfile.customDictionaryEn), [userProfile.customDictionaryEn]);
  const [reviewPriorities, setReviewPriorities] = useState<Record<string, number>>({ ...(userProfile.stats.wordsToReview || {}) });
  const [round, setRound] = useState<LetterSquareRound | null>(() => makeRound(dictionary, null, userProfile.stats.wordsToReview || {}));
  const [selected, setSelected] = useState<Coord[]>([]);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [message, setMessage] = useState('Выбирайте только соседние клетки: вверх, вниз, влево или вправо.');
  const [finished, setFinished] = useState(false);
  const rewardAppliedRef = useRef(false);
  const showKidsRewards = isKidsMode(userProfile);

  const selectedWord = selected.map(coord => round?.grid[coord.row]?.[coord.col]?.letter || '').join('');
  const selectedKeys = new Set(selected.map(keyFor));
  const reward = calculateGameReward({ type: 'letterSquare', guessedWords: score });
  const progress = showKidsRewards ? applyGameRewardToCharacter(userProfile.pet, reward) : null;

  const registerPractice = (word: string, result: WordPracticeResult) => {
    setReviewPriorities(prev => updateReviewPriorities(prev, word, result));
    void Promise.resolve(onWordPractice?.(word, result)).catch(error => console.error('Failed to save letter square practice', error));
  };

  const next = useCallback((previous?: string) => {
    setRound(makeRound(dictionary, previous, reviewPriorities));
    setSelected([]);
    setFeedback(null);
    setMessage('Выбирайте только соседние клетки: вверх, вниз, влево или вправо.');
  }, [dictionary, reviewPriorities]);

  const restart = () => {
    rewardAppliedRef.current = false;
    setScore(0);
    setAnswered(0);
    setFinished(false);
    next();
  };

  const goNext = () => {
    if (!round) return;
    if (answered >= ROUND_LIMIT) setFinished(true);
    else next(round.word.word);
  };

  const selectCell = (coord: Coord) => {
    if (!round || feedback || finished) return;
    const coordKey = keyFor(coord);
    const last = selected[selected.length - 1];
    if (last && sameCoord(last, coord)) {
      setSelected(prev => prev.slice(0, -1));
      setMessage('Последняя буква снята. Продолжайте без диагоналей.');
      return;
    }
    if (selectedKeys.has(coordKey)) {
      setMessage('Эта клетка уже выбрана. Нажмите «Стереть», чтобы начать путь заново.');
      return;
    }
    if (last && !areOrthogonalNeighbors(last, coord)) {
      setMessage('Диагонали нельзя: выбирайте букву только сверху, снизу, слева или справа.');
      return;
    }
    if (selected.length >= round.word.word.length) return;
    setSelected(prev => [...prev, coord]);
    setMessage('Отлично. Следующая буква тоже должна быть соседней без диагонали.');
  };

  const clearSelection = () => {
    if (feedback) return;
    setSelected([]);
    setMessage('Путь очищен. Начните с любой буквы и двигайтесь без диагоналей.');
  };

  const checkAnswer = () => {
    if (!round || feedback || finished) return;
    if (selected.length !== round.word.word.length) {
      setMessage(`Нужно выбрать ${round.word.word.length} букв, сейчас выбрано ${selected.length}.`);
      return;
    }
    const correct = selectedWord === round.word.word;
    const nextAnswered = answered + 1;
    setFeedback(correct ? 'correct' : 'wrong');
    setAnswered(nextAnswered);
    if (correct) setScore(value => value + 1);
    registerPractice(round.word.word, correct ? 'mastered' : 'failed');
    setMessage(correct ? 'Верно! Слово собрано без диагоналей.' : `Нужно: ${round.word.word}. Слово уйдёт в повторение.`);
    if (correct) window.setTimeout(() => { if (nextAnswered >= ROUND_LIMIT) setFinished(true); else next(round.word.word); }, 700);
  };

  if (finished && !rewardAppliedRef.current) {
    rewardAppliedRef.current = true;
    void onGameReward({ type: 'letterSquare', guessedWords: score });
  }

  if (dictionary.length < 1 || !round) return <div className="flex w-full max-w-md flex-col items-center justify-center rounded-3xl bg-white p-8 text-center shadow-xl"><div className="mb-4 text-6xl">🔠</div><h2 className="mb-2 text-2xl font-bold">Нет доступных слов</h2><p className="mb-6 text-gray-500">Для квадрата нужны английские слова из 4–9 букв с переводом.</p><button onClick={onBack} className="rounded-lg bg-indigo-600 px-6 py-2 font-bold text-white">Назад</button></div>;

  return <div className="mx-auto flex w-full max-w-2xl flex-col rounded-3xl bg-white p-4 shadow-xl sm:p-6">
    <div className="mb-5 flex items-center justify-between gap-3"><button onClick={onBack} className="rounded-xl bg-indigo-50 px-3 py-2 text-sm font-black text-indigo-700">← Меню</button><div className="rounded-full bg-indigo-50 px-3 py-2 text-sm font-black text-indigo-700">{answered}/{ROUND_LIMIT} · ⭐ {score}</div></div>
    <div className="rounded-[2rem] bg-blue-50 px-5 py-6 text-center"><div className="text-xs font-black uppercase tracking-widest text-blue-400">Квадрат слов · без диагоналей</div><div className="mt-3 text-2xl font-black text-blue-950 sm:text-3xl">{round.word.translation}</div><div className="mx-auto mt-3 w-max rounded-full bg-white px-4 py-2 text-xs font-black text-blue-700 shadow-sm">{round.word.word.length} букв</div></div>
    <div className="mt-5 flex min-h-[3.25rem] flex-wrap justify-center gap-2 rounded-3xl border-2 border-indigo-50 bg-slate-50 px-3 py-3" aria-live="polite">{Array.from({ length: round.word.word.length }, (_, index) => <span key={index} className={`flex h-10 w-10 items-center justify-center rounded-2xl border-2 text-lg font-black ${selectedWord[index] ? 'border-indigo-200 bg-white text-indigo-950' : 'border-dashed border-slate-200 bg-white/60 text-slate-300'}`}>{selectedWord[index] || '·'}</span>)}</div>
    <div className="mx-auto mt-5 grid w-full max-w-[22rem] gap-2" style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, minmax(0, 1fr))` }}>{round.grid.flat().map(cell => { const cellKey = keyFor(cell); const selectedIndex = selected.findIndex(coord => sameCoord(coord, cell)); const isSelected = selectedIndex >= 0; const isLast = selected.length > 0 && sameCoord(selected[selected.length - 1], cell); return <button key={cellKey} type="button" onClick={() => selectCell(cell)} disabled={Boolean(feedback)} className={`relative aspect-square rounded-2xl border-2 text-2xl font-black shadow-sm transition disabled:opacity-100 sm:text-3xl ${isSelected ? 'border-blue-500 bg-blue-100 text-blue-950' : 'border-amber-100 bg-white text-slate-800 hover:border-blue-200 hover:bg-blue-50'} ${isLast ? 'ring-4 ring-blue-100' : ''}`}>{cell.letter}{isSelected && <span className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">{selectedIndex + 1}</span>}</button>; })}</div>
    <div className={`mt-4 rounded-2xl px-4 py-3 text-center text-sm font-black ${feedback === 'correct' ? 'bg-green-50 text-green-700' : feedback === 'wrong' ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'}`}>{message}</div>
    <div className="mt-4 grid grid-cols-2 gap-3"><button type="button" onClick={clearSelection} disabled={Boolean(feedback)} className="rounded-2xl border-2 border-indigo-100 bg-white px-5 py-3 font-black text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50">Стереть</button>{feedback === 'wrong' ? <button type="button" onClick={goNext} className="rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white transition hover:bg-indigo-700">{answered >= ROUND_LIMIT ? 'Завершить' : 'Следующее слово'}</button> : <button type="button" onClick={checkAnswer} className="rounded-2xl bg-blue-600 px-5 py-3 font-black text-white transition hover:bg-blue-700">Проверить</button>}</div>
    <GameResultOverlay isOpen={finished} status="completed" title="Квадрат завершён" subtitle={`Собрано слов: ${score} из ${answered}`} emoji="🔠" pet={progress?.pet} xpGained={showKidsRewards ? reward.xp : 0} coinsGained={showKidsRewards ? reward.coins : 0} primaryLabel="Играть снова" secondaryLabel="В меню" onPrimary={restart} onSecondary={onBack} />
  </div>;
};
