import React, { useMemo, useRef, useState } from 'react';
import { EnrichedWord, UserProfile } from '../types';
import { COMMON_WORDS_EN } from '../dictionaries/english';
import { applyGameRewardToCharacter, calculateGameReward, GameRewardInput } from '../services/gamificationRules';
import { buildPlayableGameDictionary, pickAdaptiveSessionWord, updateReviewPriorities, WordPracticeResult } from '../services/gameSessionEngine';
import { isKidsMode } from '../services/modeFlags';
import { GameResultOverlay } from './GameResultOverlay';

type Coord = { row: number; col: number };
type Cell = Coord & { letter: string };
type Round = { word: EnrichedWord; grid: Cell[][]; path: Coord[] };

type Props = {
  onBack: () => void;
  userProfile: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
  onWordPractice?: (word: string, result: WordPracticeResult) => void | Promise<void>;
};

const SIZE = 5;
const LIMIT = 8;
const ABC = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const key = (c: Coord) => `${c.row}:${c.col}`;
const same = (a: Coord, b: Coord) => a.row === b.row && a.col === b.col;
const sideBySide = (a: Coord, b: Coord) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
const rand = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];
const letter = () => rand(ABC.split('')) || 'A';
const shuffle = <T,>(items: T[]) => [...items].sort(() => Math.random() - 0.5);
const neighbors = (c: Coord) => [
  { row: c.row - 1, col: c.col },
  { row: c.row + 1, col: c.col },
  { row: c.row, col: c.col - 1 },
  { row: c.row, col: c.col + 1 },
].filter(n => n.row >= 0 && n.row < SIZE && n.col >= 0 && n.col < SIZE);

export const buildLetterSquareDictionary = (customDictionaryEn: string[] = [], fallbackDictionary: EnrichedWord[] = COMMON_WORDS_EN) =>
  buildPlayableGameDictionary(customDictionaryEn, fallbackDictionary)
    .map(item => ({ ...item, word: item.word.toUpperCase() }))
    .filter(item => /^[A-Z]{3,10}$/.test(item.word));

const makePath = (length: number): Coord[] => {
  const cells = Array.from({ length: SIZE * SIZE }, (_, i) => ({ row: Math.floor(i / SIZE), col: i % SIZE }));
  for (let attempt = 0; attempt < 900; attempt++) {
    const path = [rand(cells) || { row: 0, col: 0 }];
    const used = new Set([key(path[0])]);
    while (path.length < length) {
      const next = shuffle(neighbors(path[path.length - 1])).find(c => !used.has(key(c)));
      if (!next) break;
      path.push(next);
      used.add(key(next));
    }
    if (path.length === length) return path;
  }
  return Array.from({ length }, (_, i) => ({ row: Math.floor(i / SIZE), col: i % SIZE }));
};

const makeRound = (pool: EnrichedWord[], prev?: string | null, review: Record<string, number> = {}): Round | null => {
  const word = pickAdaptiveSessionWord('letterSquare', pool, review, prev) || rand(pool);
  if (!word) return null;
  const path = makePath(word.word.length);
  const grid = Array.from({ length: SIZE }, (_, row) => Array.from({ length: SIZE }, (_, col) => ({ row, col, letter: letter() })));
  path.forEach((pos, i) => { grid[pos.row][pos.col] = { ...pos, letter: word.word[i] || letter() }; });
  return { word, grid, path };
};

export const LetterSquareGameV2: React.FC<Props> = ({ onBack, userProfile, onGameReward, onWordPractice }) => {
  const dictionary = useMemo(() => buildLetterSquareDictionary(userProfile.customDictionaryEn), [userProfile.customDictionaryEn]);
  const [review, setReview] = useState<Record<string, number>>({ ...(userProfile.stats.wordsToReview || {}) });
  const [round, setRound] = useState<Round | null>(() => makeRound(dictionary, null, userProfile.stats.wordsToReview || {}));
  const [selected, setSelected] = useState<Coord[]>([]);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [message, setMessage] = useState('Первая буква подсвечена. Ходить можно только по сторонам.');
  const [done, setDone] = useState(false);
  const rewardApplied = useRef(false);
  const kids = isKidsMode(userProfile);
  const word = selected.map(c => round?.grid[c.row]?.[c.col]?.letter || '').join('');
  const reward = calculateGameReward({ type: 'letterSquare', guessedWords: score });
  const progress = kids ? applyGameRewardToCharacter(userProfile.pet, reward) : null;

  const savePractice = (w: string, result: WordPracticeResult) => {
    setReview(prev => updateReviewPriorities(prev, w, result));
    void Promise.resolve(onWordPractice?.(w, result)).catch(error => console.error('Failed to save letter square practice', error));
  };
  const next = (prev?: string) => { setRound(makeRound(dictionary, prev, review)); setSelected([]); setFeedback(null); setMessage('Первая буква подсвечена. Ходить можно только по сторонам.'); };
  const clear = () => { if (!feedback) { setSelected([]); setMessage('Путь очищен. Начните с подсвеченной первой буквы.'); } };
  const choose = (cell: Coord) => {
    if (!round || feedback || done) return;
    const last = selected[selected.length - 1];
    if (last && same(last, cell)) { setSelected(s => s.slice(0, -1)); setMessage('Последняя буква снята.'); return; }
    if (selected.some(c => same(c, cell))) { setMessage('Эта клетка уже выбрана. Нажмите «Стереть».'); return; }
    if (last && !sideBySide(last, cell)) { setMessage('Диагонали нельзя: только вверх, вниз, влево или вправо.'); return; }
    if (selected.length >= round.word.word.length) return;
    setSelected(s => [...s, cell]);
  };
  const check = () => {
    if (!round || feedback) return;
    if (selected.length !== round.word.word.length) { setMessage(`Нужно выбрать ${round.word.word.length} букв, сейчас ${selected.length}.`); return; }
    const ok = word === round.word.word;
    const nextAnswered = answered + 1;
    setFeedback(ok ? 'correct' : 'wrong');
    setAnswered(nextAnswered);
    if (ok) setScore(v => v + 1);
    savePractice(round.word.word, ok ? 'mastered' : 'failed');
    setMessage(ok ? 'Верно!' : `Нужно: ${round.word.word}`);
    if (ok) window.setTimeout(() => nextAnswered >= LIMIT ? setDone(true) : next(round.word.word), 550);
  };
  const goNext = () => round && (answered >= LIMIT ? setDone(true) : next(round.word.word));
  const restart = () => { rewardApplied.current = false; setScore(0); setAnswered(0); setDone(false); next(); };

  if (done && !rewardApplied.current) { rewardApplied.current = true; void onGameReward({ type: 'letterSquare', guessedWords: score }); }
  if (!round) return <div className="rounded-3xl bg-white p-8 text-center shadow-xl"><div className="text-5xl">🔠</div><h2 className="mt-3 text-2xl font-black">Нет доступных слов</h2><p className="mt-2 text-sm font-bold text-gray-500">Нужны слова из 3–10 букв с переводом.</p><button onClick={onBack} className="mt-5 rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white">Назад</button></div>;

  const start = round.path[0];
  return <div className="mx-auto flex min-h-[calc(100svh-7rem)] w-full max-w-md flex-col rounded-3xl bg-white p-3 shadow-xl sm:min-h-0 sm:p-4">
    <div className="flex items-center justify-between gap-2"><button onClick={onBack} className="rounded-xl bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">← Меню</button><div className="rounded-full bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">{answered}/{LIMIT} · ⭐ {score}</div></div>
    <div className="mt-2 rounded-[1.5rem] bg-blue-50 px-4 py-3 text-center"><div className="text-[10px] font-black uppercase tracking-widest text-blue-400">Квадрат слов</div><div className="mt-1 text-xl font-black leading-tight text-blue-950">{round.word.translation}</div><div className="mt-2 flex justify-center gap-2 text-[11px] font-black text-blue-700"><span className="rounded-full bg-white px-3 py-1 shadow-sm">{round.word.word.length} букв</span><span className="rounded-full bg-white px-3 py-1 shadow-sm">старт: {round.word.word[0]}</span></div></div>
    <div className="mx-auto mt-3 grid w-full max-w-[19rem] flex-1 content-center gap-1.5" style={{ gridTemplateColumns: `repeat(${SIZE}, minmax(0, 1fr))` }}>{round.grid.flat().map(cell => { const i = selected.findIndex(c => same(c, cell)); const isStart = start && same(start, cell) && selected.length === 0 && !feedback; const isLast = selected.length > 0 && same(selected[selected.length - 1], cell); return <button key={key(cell)} type="button" onClick={() => choose(cell)} disabled={Boolean(feedback)} className={`relative aspect-square rounded-2xl border-2 text-2xl font-black shadow-sm disabled:opacity-100 ${i >= 0 ? 'border-blue-500 bg-blue-100 text-blue-950' : isStart ? 'border-blue-400 bg-blue-50 text-blue-950 ring-4 ring-blue-100' : 'border-amber-100 bg-white text-slate-800'} ${isLast ? 'ring-4 ring-blue-100' : ''}`}>{cell.letter}{i >= 0 && <span className="absolute left-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] font-black text-white">{i + 1}</span>}{isStart && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-1.5 py-0.5 text-[9px] font-black uppercase text-white">старт</span>}</button>; })}</div>
    <div className={`mt-3 rounded-2xl px-3 py-2 text-center text-xs font-black ${feedback === 'correct' ? 'bg-green-50 text-green-700' : feedback === 'wrong' ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'}`}>{message}</div>
    <div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={clear} disabled={Boolean(feedback)} className="rounded-2xl border-2 border-indigo-100 bg-white px-4 py-3 text-sm font-black text-indigo-700 disabled:opacity-50">Стереть</button>{feedback === 'wrong' ? <button type="button" onClick={goNext} className="rounded-2xl bg-indigo-600 px-4 py-3 text-sm font-black text-white">{answered >= LIMIT ? 'Завершить' : 'Дальше'}</button> : <button type="button" onClick={check} className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white">Проверить</button>}</div>
    <GameResultOverlay isOpen={done} status="completed" title="Квадрат завершён" subtitle={`Собрано слов: ${score} из ${answered}`} emoji="🔠" pet={progress?.pet} xpGained={kids ? reward.xp : 0} coinsGained={kids ? reward.coins : 0} primaryLabel="Играть снова" secondaryLabel="В меню" onPrimary={restart} onSecondary={onBack} />
  </div>;
};
