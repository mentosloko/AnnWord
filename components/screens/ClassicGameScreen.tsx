import React, { useEffect, useMemo, useState } from 'react';
import { CharStatus, GameState, GameSettings, UserProfile, WordLength } from '../../types';
import { applyGameRewardToCharacter, calculateGameReward } from '../../services/gamificationRules';
import { isKidsMode } from '../../services/modeFlags';
import { DictionaryPeek } from '../DictionaryPeek';
import { GameResultOverlay } from '../GameResultOverlay';
import { Grid } from '../Grid';
import { Keyboard } from '../Keyboard';
import { ScreenContainer } from '../layout/ScreenContainer';

interface Props {
  gameState: GameState;
  settings: GameSettings;
  userProfile: UserProfile;
  isAuthenticated?: boolean;
  rulesViewerKey?: string;
  keyStatuses: Record<string, CharStatus>;
  shakeRowIndex: number | null;
  dictionaryWords?: string[];
  dictionaryLabel?: string;
  dictionaryIcon?: string;
  onChar: (char: string) => void;
  onDelete: () => void;
  onEnter: () => void;
  onHint: () => void;
  onRestart: () => void;
  onBackHome: () => void;
  onRegister?: () => void;
  onDictionaryPeek?: () => boolean | Promise<boolean>;
}

const blur = () => { if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) document.activeElement.blur(); };
const inferAuth = (profile: UserProfile): boolean => profile.username !== 'Гость' || Boolean(profile.role) || Boolean(profile.accountMode);
const getActiveWordLength = (gameState: GameState, fallback: WordLength): WordLength => (gameState.secretWord?.length === 4 || gameState.secretWord?.length === 5 || gameState.secretWord?.length === 6 ? gameState.secretWord.length as WordLength : fallback);
const hasSeenRules = (key: string): boolean => { try { return typeof window !== 'undefined' && window.localStorage.getItem(key) === 'true'; } catch { return true; } };

export const ClassicGameScreen: React.FC<Props> = ({ gameState, settings, userProfile, isAuthenticated, rulesViewerKey = 'guest', keyStatuses, shakeRowIndex, dictionaryWords = [], dictionaryLabel = 'Мой словарь', dictionaryIcon = '📖', onChar, onDelete, onEnter, onHint, onRestart, onBackHome, onRegister, onDictionaryPeek }) => {
  const authenticated = isAuthenticated ?? inferAuth(userProfile);
  const showKidsRewards = isKidsMode(userProfile, authenticated);
  const rulesStorageKey = useMemo(() => `annword:game-intro:v1:${rulesViewerKey}:classic`, [rulesViewerKey]);
  const [showRules, setShowRules] = useState(() => !hasSeenRules(rulesStorageKey));
  const [seen, setSeen] = useState(() => hasSeenRules(rulesStorageKey));
  const [showHint, setShowHint] = useState(false);
  const finished = gameState.gameStatus !== 'playing';
  const spent = gameState.hintCoinsSpent ?? 0;
  const hintUsed = spent > 0;
  const activeWordLength = getActiveWordLength(gameState, settings.wordLength);
  const reward = finished ? calculateGameReward({ type: 'wordle', won: gameState.gameStatus === 'won' }) : null;
  const progress = showKidsRewards && reward ? applyGameRewardToCharacter(userProfile.pet, reward) : null;
  const hintLabel = showKidsRewards
    ? userProfile.coins > 0 ? 'Подсказка · 1★' : 'Подсказка · нужно 1★'
    : 'Подсказка';

  useEffect(() => {
    const alreadySeen = hasSeenRules(rulesStorageKey);
    setSeen(alreadySeen);
    setShowRules(!alreadySeen);
  }, [rulesStorageKey]);
  useEffect(() => { if (gameState.currentGuess.length > 0 || finished) setShowHint(false); }, [gameState.currentGuess, finished]);

  const closeRules = () => {
    setShowRules(false);
    setSeen(true);
    try { window.localStorage.setItem(rulesStorageKey, 'true'); } catch { /* rules persistence must not block the game */ }
    blur();
  };
  const clickHint = () => { if (!authenticated) return; blur(); setShowRules(false); setShowHint(true); if (!gameState.hint && !gameState.loadingHint && !hintUsed) onHint(); };
  const register = () => { blur(); if (onRegister) onRegister(); else onBackHome(); };
  const restart = () => { if (!finished && gameState.secretWord && gameState.guesses.length > 0 && !window.confirm('Начать заново? Текущий прогресс попытки будет потерян.')) return; onRestart(); };

  return (
    <ScreenContainer compact className="h-[100svh] max-w-none overflow-hidden px-1.5 py-1.5 sm:px-3 sm:py-2 lg:px-5">
      <div className="relative mx-auto grid h-full min-h-0 w-full max-w-[88rem] grid-rows-[auto_auto_minmax(0,1fr)_auto] gap-[clamp(0.2rem,0.7svh,0.55rem)] overflow-hidden">
        <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={onBackHome} aria-label="Назад в меню" className="flex h-[clamp(2.1rem,6.2svh,2.75rem)] w-[clamp(2.1rem,6.2svh,2.75rem)] items-center justify-center rounded-xl border-2 border-indigo-100 bg-white text-lg font-black text-indigo-700 shadow-sm">←</button>
          <div className="flex min-w-0 justify-center">
            {authenticated ? <button type="button" onClick={clickHint} disabled={finished || hintUsed} aria-label={hintLabel} className="min-w-[7.75rem] rounded-xl border-2 border-blue-100 bg-blue-50 px-2.5 py-[clamp(0.3rem,1svh,0.55rem)] text-[clamp(0.7rem,1.7svh,0.875rem)] font-black text-blue-700 disabled:opacity-50 sm:min-w-[9rem]">{gameState.loadingHint ? '...' : hintUsed ? 'Подсказка использована' : hintLabel}</button> : <button type="button" onClick={register} className="min-w-[7.75rem] rounded-xl border-2 border-purple-100 bg-purple-50 px-2.5 py-[clamp(0.3rem,1svh,0.55rem)] text-[clamp(0.7rem,1.7svh,0.875rem)] font-black text-purple-700 sm:min-w-[9rem]">Регистрация</button>}
          </div>
          <div className="flex items-center gap-1">
            <DictionaryPeek words={dictionaryWords} wordLength={activeWordLength} iconOnly locked={!authenticated} lockedMessage="Словарь доступен после регистрации в Kids или Practice." label={dictionaryLabel} icon={dictionaryIcon} onBeforeOpen={showKidsRewards ? onDictionaryPeek : undefined} chargeLabel="Просмотр словаря стоит как подсказка." />
            <button type="button" aria-label="Показать правила" aria-expanded={showRules} onClick={() => { blur(); setShowHint(false); setShowRules(true); }} className={`flex h-9 w-9 items-center justify-center rounded-xl border font-black ${seen ? 'border-indigo-50 bg-white text-indigo-300' : 'border-indigo-100 bg-indigo-50 text-indigo-700'}`}>?</button>
            <button type="button" aria-label="Начать игру заново" onClick={restart} className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-lg font-black text-indigo-700">↻</button>
          </div>
        </header>
        <div aria-live="polite" className="min-h-[1.5rem] text-center text-xs font-black text-rose-500 sm:text-sm">{gameState.error || ''}</div>
        {showHint && <div role="dialog" aria-label="Подсказка" className="absolute left-1/2 top-11 z-30 w-[min(21rem,92vw)] -translate-x-1/2 rounded-3xl border-2 border-blue-100 bg-white p-4 text-sm text-blue-950 shadow-2xl"><div className="flex gap-3"><div className="flex-1 font-bold">{gameState.loadingHint ? 'Готовлю подсказку...' : gameState.hint || 'Подсказка скоро появится.'}</div><button type="button" aria-label="Закрыть подсказку" onClick={() => { setShowHint(false); blur(); }} className="font-black text-blue-400">×</button></div></div>}
        <section className="flex min-h-0 items-center justify-center overflow-hidden rounded-[1.2rem] border-2 border-indigo-50 bg-white/85 px-1 py-1 shadow-sm sm:rounded-[1.75rem] sm:px-2"><Grid guesses={gameState.guesses} currentGuess={gameState.currentGuess} secretWord={gameState.secretWord} wordLength={activeWordLength} maxGuesses={6} shakeRowIndex={shakeRowIndex} /></section>
        <footer className="flex shrink-0 justify-center overflow-hidden"><Keyboard onChar={onChar} onDelete={onDelete} onEnter={onEnter} letterStatuses={keyStatuses} /></footer>
      </div>

      {showRules && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-indigo-950/55 p-4 backdrop-blur-sm" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="classic-rules-title" className="w-full max-w-md rounded-[2rem] border-2 border-indigo-100 bg-white p-5 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-widest text-indigo-400">Первый запуск</div><h2 id="classic-rules-title" className="mt-1 text-2xl font-black text-indigo-950">Как играть в «Классику»</h2></div><button type="button" aria-label="Закрыть правила" onClick={closeRules} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xl font-black text-indigo-500">×</button></div><ul className="mt-5 space-y-3"><li className="flex gap-3 rounded-2xl bg-indigo-50/70 px-4 py-3 text-sm font-bold text-indigo-950"><span aria-hidden="true" className="text-indigo-500">✓</span><span>Угадайте английское слово за шесть попыток.</span></li><li className="flex gap-3 rounded-2xl bg-indigo-50/70 px-4 py-3 text-sm font-bold text-indigo-950"><span aria-hidden="true" className="text-indigo-500">✓</span><span>Зелёная буква стоит верно, жёлтая есть в слове, серая отсутствует.</span></li><li className="flex gap-3 rounded-2xl bg-indigo-50/70 px-4 py-3 text-sm font-bold text-indigo-950"><span aria-hidden="true" className="text-indigo-500">✓</span><span>Введите слово на клавиатуре и нажмите «Ввод».</span></li></ul><button type="button" onClick={closeRules} className="mt-5 w-full rounded-2xl bg-indigo-600 px-5 py-4 font-black text-white">Начать игру</button><p className="mt-3 text-center text-xs font-bold text-gray-400">Правила всегда можно открыть снова кнопкой «?».</p></div></div>}

      {finished && reward && <GameResultOverlay isOpen status={gameState.gameStatus === 'won' ? 'won' : 'lost'} title={gameState.gameStatus === 'won' ? 'Победа!' : 'Почти получилось'} subtitle={authenticated ? (gameState.gameStatus === 'won' ? 'Слово угадано.' : 'Попробуем ещё раз?') : 'Создайте аккаунт в Kids или Practice, чтобы сохранять прогресс и открыть словари.'} emoji={gameState.gameStatus === 'won' ? '🎉' : '💪'} pet={progress?.pet} xpGained={showKidsRewards ? reward.xp : 0} coinsGained={showKidsRewards ? reward.coins : 0} primaryLabel={authenticated ? 'Играть снова' : 'Создать аккаунт'} secondaryLabel={authenticated ? 'В меню' : 'На главную'} onPrimary={authenticated ? onRestart : register} onSecondary={onBackHome} details={<span>Слово: <b>{gameState.secretWord}</b>{gameState.secretWordData?.translation ? ` · ${gameState.secretWordData.translation}` : ''}{spent && showKidsRewards ? ` · подсказка: −${spent} ${spent === 1 ? 'монета' : 'монеты'}` : ''}</span>} />}
    </ScreenContainer>
  );
};