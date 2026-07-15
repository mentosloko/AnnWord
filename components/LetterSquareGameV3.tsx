import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { applyGameRewardToCharacter, calculateGameReward, CharacterProgressResult, GameRewardInput } from '../services/gamificationRules';
import { buildPlayableGameDictionary, pickAdaptiveSessionWord, updateReviewPriorities, WordPracticeResult } from '../services/gameSessionEngine';
import { isKidsMode } from '../services/modeFlags';
import { GameResultOverlay } from './GameResultOverlay';

type Coord = { row: number; col: number };
type Cell = Coord & { letter: string };
type Round = { word: EnrichedWord; grid: Cell[][]; path: Coord[] };
type Props = { onBack: () => void; userProfile: UserProfile; onGameReward: (input: GameRewardInput) => void | Promise<void>; onWordPractice?: (word: string, result: WordPracticeResult) => void | Promise<void>; };
const SIZE = 5, LIMIT = 8, ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const keyOf = (coord: Coord) => `${coord.row}:${coord.col}`;
const same = (a: Coord, b: Coord) => a.row === b.row && a.col === b.col;
const side = (a: Coord, b: Coord) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
const random = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);
const neighbours = (coord: Coord) => [{ row: coord.row - 1, col: coord.col }, { row: coord.row + 1, col: coord.col }, { row: coord.row, col: coord.col - 1 }, { row: coord.row, col: coord.col + 1 }].filter(item => item.row >= 0 && item.row < SIZE && item.col >= 0 && item.col < SIZE);

export const buildLetterSquareDictionary = (customDictionaryEn: string[] = [], fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN) => buildPlayableGameDictionary(customDictionaryEn, fallbackDictionary).map(item => ({ ...item, word: item.word.toUpperCase() })).filter(item => /^[A-Z]{3,10}$/.test(item.word));

const pathFor = (length: number) => {
  const cells = Array.from({ length: SIZE * SIZE }, (_, index) => ({ row: Math.floor(index / SIZE), col: index % SIZE }));
  for (let attempt = 0; attempt < 900; attempt += 1) {
    const path = [random(cells) || { row: 0, col: 0 }];
    const used = new Set([keyOf(path[0])]);
    while (path.length < length) {
      const next = shuffle(neighbours(path[path.length - 1])).find(coord => !used.has(keyOf(coord)));
      if (!next) break;
      path.push(next);
      used.add(keyOf(next));
    }
    if (path.length === length) return path;
  }
  return Array.from({ length }, (_, index) => ({ row: Math.floor(index / SIZE), col: index % SIZE }));
};

const makeRound = (pool: EnrichedWord[], previous?: string | null, review: Record<string, number> = {}): Round | null => {
  const word = pickAdaptiveSessionWord('letterSquare', pool, review, previous) || random(pool);
  if (!word) return null;
  const path = pathFor(word.word.length);
  const grid = Array.from({ length: SIZE }, (_, row) => Array.from({ length: SIZE }, (_, col) => ({ row, col, letter: random(ABC.split('')) || 'A' })));
  path.forEach((coord, index) => { grid[coord.row][coord.col] = { ...coord, letter: word.word[index] || 'A' }; });
  return { word, grid, path };
};

export const LetterSquareGameV3: React.FC<Props> = ({ onBack, userProfile, onGameReward, onWordPractice }) => {
  const dictionary = useMemo(() => buildLetterSquareDictionary(userProfile.customDictionaryEn), [userProfile.customDictionaryEn]);
  const [review, setReview] = useState<Record<string, number>>({ ...(userProfile.stats.wordsToReview || {}) });
  const [round, setRound] = useState<Round | null>(() => makeRound(dictionary, null, userProfile.stats.wordsToReview || {}));
  const [selected, setSelected] = useState<Coord[]>([]);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [message, setMessage] = useState('Соберите слово змейкой из соседних клеток. Диагонали нельзя.');
  const [hint, setHint] = useState(false);
  const [done, setDone] = useState(false);
  const [resultProgress, setResultProgress] = useState<CharacterProgressResult | null>(null);
  const rewardApplied = useRef(false);
  const nextTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const kids = isKidsMode(userProfile);
  const word = selected.map(coord => round?.grid[coord.row]?.[coord.col]?.letter || '').join('');
  const reward = useMemo(() => calculateGameReward({ type: 'letterSquare', guessedWords: score }), [score]);

  const clearTimer = useCallback(() => {
    if (nextTimerRef.current !== null) window.clearTimeout(nextTimerRef.current);
    nextTimerRef.current = null;
  }, []);
  useEffect(() => clearTimer, [clearTimer]);

  const save = (currentWord: string, result: WordPracticeResult) => {
    setReview(previous => updateReviewPriorities(previous, currentWord, result));
    void Promise.resolve(onWordPractice?.(currentWord, result)).catch(error => console.error('Failed to save Snake practice', error));
  };
  const next = useCallback((previous?: string) => {
    clearTimer();
    setRound(makeRound(dictionary, previous, review));
    setSelected([]);
    setFeedback(null);
    setHint(false);
    setMessage('Соберите слово змейкой из соседних клеток. Диагонали нельзя.');
  }, [clearTimer, dictionary, review]);
  const finish = () => { clearTimer(); setDone(true); };
  const scheduleNext = (action: () => void) => {
    clearTimer();
    nextTimerRef.current = window.setTimeout(() => {
      nextTimerRef.current = null;
      action();
    }, 550);
  };
  const choose = (cell: Coord) => {
    if (!round || feedback || done) return;
    const last = selected[selected.length - 1];
    if (last && same(last, cell)) { setSelected(value => value.slice(0, -1)); return; }
    if (selected.some(coord => same(coord, cell))) { setMessage('Эта клетка уже выбрана. Нажмите «Стереть».'); return; }
    if (last && !side(last, cell)) { setMessage('Диагонали нельзя: только вверх, вниз, влево или вправо.'); return; }
    if (selected.length < round.word.word.length) setSelected(value => [...value, cell]);
  };
  const check = () => {
    if (!round || feedback) return;
    if (selected.length !== round.word.word.length) { setMessage(`Нужно выбрать ${round.word.word.length} букв, сейчас ${selected.length}.`); return; }
    const correct = word === round.word.word;
    const nextAnswered = answered + 1;
    setFeedback(correct ? 'correct' : 'wrong');
    setAnswered(nextAnswered);
    if (correct) setScore(value => value + 1);
    save(round.word.word, correct ? 'mastered' : 'failed');
    setMessage(correct ? 'Верно!' : `Нужно: ${round.word.word}`);
    if (correct) scheduleNext(() => nextAnswered >= LIMIT ? finish() : next(round.word.word));
  };
  const goNext = () => round && (answered >= LIMIT ? finish() : next(round.word.word));
  const restart = () => {
    clearTimer();
    rewardApplied.current = false;
    setScore(0);
    setAnswered(0);
    setDone(false);
    setResultProgress(null);
    setSelected([]);
    setFeedback(null);
    setHint(false);
    setRound(makeRound(dictionary, null, review));
    setMessage('Соберите слово змейкой из соседних клеток. Диагонали нельзя.');
  };
  const leave = () => { clearTimer(); onBack(); };

  useEffect(() => {
    if (!done || rewardApplied.current) return;
    rewardApplied.current = true;
    setResultProgress(kids ? applyGameRewardToCharacter(userProfile.pet, reward) : null);
    void Promise.resolve(onGameReward({ type: 'letterSquare', guessedWords: score })).catch(error => console.error('Failed to save Snake result', error));
  }, [done, kids, onGameReward, reward, score, userProfile.pet]);

  if (!round) return <div className="rounded-3xl bg-white p-8 text-center shadow-xl"><div className="text-5xl">🔠</div><h2 className="mt-3 text-2xl font-black">Нет доступных слов</h2><p className="mt-2 text-sm font-bold text-gray-500">Нужны слова из 3–10 букв с переводом.</p><button onClick={leave} className="mt-5 rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white">Назад</button></div>;
  const start = round.path[0];
  return <div className="mx-auto flex h-[calc(100svh-1rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white p-2 shadow-xl sm:h-auto sm:min-h-0 sm:p-4">
    <div className="flex shrink-0 items-center justify-between gap-2"><button onClick={leave} className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">← Меню</button><div className="rounded-full bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">{answered}/{LIMIT} · ⭐ {score}</div></div>
    <div className="mt-1.5 shrink-0 rounded-[1.25rem] bg-blue-50 px-3 py-2 text-center sm:mt-2 sm:rounded-[1.5rem] sm:px-4 sm:py-3"><div className="text-[10px] font-black uppercase tracking-widest text-blue-400">Змейка</div><div className="mt-0.5 line-clamp-2 text-base font-black leading-tight text-blue-950 sm:mt-1 sm:text-xl">{round.word.translation}</div><div className="mt-1.5 flex justify-center gap-2 text-[10px] font-black text-blue-700 sm:mt-2 sm:text-[11px]"><span className="rounded-full bg-white px-2.5 py-1 shadow-sm sm:px-3">{round.word.word.length} букв</span><button type="button" onClick={() => { setHint(true); setMessage(`Подсказка: первая буква — ${round.word.word[0]}.`); }} disabled={hint || Boolean(feedback)} className="rounded-full bg-white px-2.5 py-1 font-black text-blue-700 shadow-sm disabled:opacity-50 sm:px-3">1-я буква</button></div></div>
    <div className="mx-auto mt-2 grid w-[min(100%,18.25rem,calc(100svh-18rem))] shrink-0 gap-1.5 sm:mt-3 sm:w-full sm:max-w-[19rem]" style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}>{round.grid.flat().map(cell => { const index = selected.findIndex(coord => same(coord, cell)); const showStart = hint && start && same(start, cell) && selected.length === 0 && !feedback; const isLast = selected.length > 0 && same(selected[selected.length - 1], cell); return <button key={keyOf(cell)} type="button" aria-label={`Буква ${cell.letter}, строка ${cell.row + 1}, столбец ${cell.col + 1}${index >= 0 ? `, позиция ${index + 1} в слове` : ''}`} onClick={() => choose(cell)} disabled={Boolean(feedback)} className={`relative aspect-square rounded-xl border-2 text-xl font-black shadow-sm disabled:opacity-100 sm:rounded-2xl sm:text-2xl ${index >= 0 ? 'border-blue-500 bg-blue-100 text-blue-950' : showStart ? 'border-blue-400 bg-blue-50 text-blue-950 ring-4 ring-blue-100' : 'border-amber-100 bg-white text-slate-800'} ${isLast ? 'ring-4 ring-blue-100' : ''}`}>{cell.letter}{index >= 0 && <span className="absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-blue-500 text-[9px] font-black text-white sm:left-1 sm:top-1 sm:h-5 sm:w-5 sm:text-[10px]">{index + 1}</span>}{showStart && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-1 py-0.5 text-[8px] font-black uppercase text-white sm:bottom-1 sm:px-1.5 sm:text-[9px]">старт</span>}</button>; })}</div>
    <div className={`mt-2 shrink-0 rounded-2xl px-3 py-2 text-center text-[11px] font-black sm:mt-3 sm:text-xs ${feedback === 'correct' ? 'bg-green-50 text-green-700' : feedback === 'wrong' ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'}`}>{message}</div>
    <div className="mt-2 grid shrink-0 grid-cols-2 gap-2 pb-[env(safe-area-inset-bottom)] sm:mt-3"><button type="button" onClick={() => { if (!feedback) { setSelected([]); setMessage(hint ? 'Путь очищен. Подсказка активна.' : 'Путь очищен.'); } }} disabled={Boolean(feedback)} className="rounded-2xl border-2 border-indigo-100 bg-white px-4 py-2.5 text-sm font-black text-indigo-700 disabled:opacity-50 sm:py-3">Стереть</button>{feedback === 'wrong' ? <button type="button" onClick={goNext} className="rounded-2xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white sm:py-3">{answered >= LIMIT ? 'Завершить' : 'Дальше'}</button> : <button type="button" onClick={check} className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-black text-white sm:py-3">Проверить</button>}</div>
    <GameResultOverlay isOpen={done} status="completed" title="Змейка завершена" subtitle={`Собрано слов: ${score} из ${answered}`} emoji="🔠" pet={resultProgress?.pet} xpGained={kids ? reward.xp : 0} coinsGained={kids ? reward.coins : 0} primaryLabel="Играть снова" secondaryLabel="В меню" onPrimary={restart} onSecondary={leave} />
  </div>;
};
