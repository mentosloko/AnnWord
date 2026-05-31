import React, { useEffect, useState } from 'react';
import { CharStatus, GameState, GameSettings, UserProfile } from '../../types';
import { applyGameRewardToCharacter, calculateGameReward } from '../../services/gamificationRules';
import { DictionaryPeek } from '../DictionaryPeek';
import { GameResultOverlay } from '../GameResultOverlay';
import { Grid } from '../Grid';
import { Keyboard } from '../Keyboard';
import { ScreenContainer } from '../layout/ScreenContainer';

interface Props {
  gameState: GameState;
  settings: GameSettings;
  userProfile: UserProfile;
  keyStatuses: Record<string, CharStatus>;
  shakeRowIndex: number | null;
  onChar: (char: string) => void;
  onDelete: () => void;
  onEnter: () => void;
  onHint: () => void;
  onRestart: () => void;
  onBackHome: () => void;
}

const RULES = 'annword:wordle-rules-seen';
const blur = () => {
  if (typeof document !== 'undefined' && document.activeElement instanceof HTMLElement) document.activeElement.blur();
};

export const ClassicGameScreen: React.FC<Props> = ({ gameState, settings, userProfile, keyStatuses, shakeRowIndex, onChar, onDelete, onEnter, onHint, onRestart, onBackHome }) => {
  const [showRules, setShowRules] = useState(false);
  const [seen, setSeen] = useState(true);
  const [showHint, setShowHint] = useState(false);
  const finished = gameState.gameStatus !== 'playing';
  const spent = gameState.hintCoinsSpent ?? 0;
  const hintUsed = spent > 0;
  const reward = finished ? calculateGameReward({ type: 'wordle', won: gameState.gameStatus === 'won' }) : null;
  const progress = reward ? applyGameRewardToCharacter(userProfile.pet, reward) : null;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const value = localStorage.getItem(RULES) === 'true';
    setSeen(value);
    if (!value) setShowRules(true);
  }, []);

  useEffect(() => {
    if (gameState.currentGuess.length > 0 || finished) setShowHint(false);
  }, [gameState.currentGuess, finished]);

  const closeRules = () => {
    setShowRules(false);
    setSeen(true);
    localStorage.setItem(RULES, 'true');
    blur();
  };
  const clickHint = () => {
    blur();
    setShowRules(false);
    setShowHint(true);
    if (!gameState.hint && !gameState.loadingHint && !hintUsed) onHint();
  };

  return (
    <ScreenContainer compact className="h-[100dvh] max-w-none overflow-hidden px-1.5 py-1.5 sm:px-3 sm:py-2 lg:px-5">
      <div className="relative mx-auto grid h-full min-h-0 w-full max-w-[88rem] grid-rows-[auto_minmax(0,1fr)_auto] gap-[clamp(0.2rem,0.7dvh,0.55rem)] overflow-hidden">
        <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={onBackHome} className="flex h-[clamp(2.1rem,6.2dvh,2.75rem)] w-[clamp(2.1rem,6.2dvh,2.75rem)] items-center justify-center rounded-xl border-2 border-indigo-100 bg-white text-lg font-black text-indigo-700 shadow-sm">←</button>
          <div className="flex min-w-0 justify-center">
            <button type="button" onClick={clickHint} disabled={finished || hintUsed} className="min-w-[7.75rem] rounded-xl border-2 border-blue-100 bg-blue-50 px-2.5 py-[clamp(0.3rem,1dvh,0.55rem)] text-[clamp(0.7rem,1.7dvh,0.875rem)] font-black text-blue-700 disabled:opacity-50 sm:min-w-[9rem]">
              {gameState.loadingHint ? '...' : hintUsed ? 'Подсказка использована' : 'Подсказка · −1 ₽'}
            </button>
          </div>
          <div className="flex items-center gap-1">
            <DictionaryPeek words={userProfile.customDictionaryEn} wordLength={settings.wordLength} iconOnly />
            <button type="button" onClick={() => { blur(); setShowHint(false); setShowRules(value => !value); }} className={`flex h-9 w-9 items-center justify-center rounded-xl border font-black ${seen ? 'border-indigo-50 bg-white text-indigo-300' : 'border-indigo-100 bg-indigo-50 text-indigo-700'}`}>?</button>
            <button type="button" onClick={onRestart} className="flex h-9 w-9 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-lg font-black text-indigo-700">↻</button>
          </div>
        </header>

        {showRules && <div className="absolute right-0 top-11 z-30 w-[min(21rem,92vw)] rounded-3xl border-2 border-indigo-100 bg-white p-4 text-sm text-indigo-950 shadow-2xl"><div className="mb-3 flex justify-between font-black"><span>Как играть</span><button onClick={closeRules}>×</button></div><p className="font-bold">Соберите слово за 6 попыток. Зелёная буква стоит верно, жёлтая есть в слове, серая отсутствует.</p></div>}
        {showHint && <div className="absolute left-1/2 top-11 z-30 w-[min(21rem,92vw)] -translate-x-1/2 rounded-3xl border-2 border-blue-100 bg-white p-4 text-sm text-blue-950 shadow-2xl"><div className="flex gap-3"><div className="flex-1 font-bold">{gameState.loadingHint ? 'Готовлю подсказку...' : gameState.hint || 'Подсказка скоро появится.'}</div><button onClick={() => { setShowHint(false); blur(); }} className="font-black text-blue-400">×</button></div></div>}

        <section className="flex min-h-0 items-center justify-center overflow-hidden rounded-[1.2rem] border-2 border-indigo-50 bg-white/85 px-1 py-1 shadow-sm sm:rounded-[1.75rem] sm:px-2">
          <Grid guesses={gameState.guesses} currentGuess={gameState.currentGuess} secretWord={gameState.secretWord} wordLength={settings.wordLength} maxGuesses={6} shakeRowIndex={shakeRowIndex} />
        </section>
        <footer className="flex shrink-0 justify-center overflow-hidden"><Keyboard onChar={onChar} onDelete={onDelete} onEnter={onEnter} letterStatuses={keyStatuses} /></footer>
      </div>
      {finished && reward && progress && <GameResultOverlay isOpen status={gameState.gameStatus === 'won' ? 'won' : 'lost'} title={gameState.gameStatus === 'won' ? 'Победа!' : 'Почти получилось'} subtitle={gameState.gameStatus === 'won' ? 'Слово угадано.' : 'Попробуем ещё раз?'} emoji={gameState.gameStatus === 'won' ? '🎉' : '💪'} pet={progress.pet} xpGained={reward.xp} coinsGained={reward.coins} onPrimary={onRestart} onSecondary={onBackHome} details={<span>Слово: <b>{gameState.secretWord}</b>{gameState.secretWordData?.translation ? ` · ${gameState.secretWordData.translation}` : ''}{spent ? ` · подсказка: −${spent} ₽` : ''}</span>} />}
    </ScreenContainer>
  );
};
