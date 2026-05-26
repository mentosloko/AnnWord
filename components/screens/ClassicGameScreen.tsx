import React, { useState } from 'react';
import { CharStatus, GameState, GameSettings, UserProfile } from '../../types';
import { applyGameRewardToCharacter, calculateGameReward } from '../../services/gamificationRules';
import { GameResultOverlay } from '../GameResultOverlay';
import { Grid } from '../Grid';
import { Keyboard } from '../Keyboard';
import { ScreenContainer } from '../layout/ScreenContainer';

interface ClassicGameScreenProps {
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

const blurActiveElement = () => {
  if (typeof document === 'undefined') return;
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement) activeElement.blur();
};

export const ClassicGameScreen: React.FC<ClassicGameScreenProps> = ({
  gameState,
  settings,
  userProfile,
  keyStatuses,
  shakeRowIndex,
  onChar,
  onDelete,
  onEnter,
  onHint,
  onRestart,
  onBackHome,
}) => {
  const [showRules, setShowRules] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const isFinished = gameState.gameStatus === 'won' || gameState.gameStatus === 'lost';
  const hintCoinsSpent = gameState.hintCoinsSpent ?? 0;
  const rewardPreview = isFinished
    ? calculateGameReward({ type: 'wordle', won: gameState.gameStatus === 'won', coinsAdjustment: -hintCoinsSpent })
    : null;
  const progressPreview = rewardPreview ? applyGameRewardToCharacter(userProfile.pet, rewardPreview) : null;

  const closeHint = () => {
    setShowHint(false);
    blurActiveElement();
  };

  const handleHintClick = () => {
    blurActiveElement();
    setShowRules(false);
    setShowHint(true);
    if (!gameState.hint && !gameState.loadingHint) onHint();
  };

  const handleRulesClick = () => {
    blurActiveElement();
    setShowHint(false);
    setShowRules(prev => !prev);
  };

  return (
    <ScreenContainer compact className="h-[100dvh] max-w-none overflow-hidden px-2 py-2 sm:px-4 sm:py-3 lg:px-6">
      <div className="relative mx-auto grid h-full min-h-0 w-full max-w-[88rem] grid-rows-[auto_minmax(0,1fr)_auto] gap-2 overflow-hidden lg:gap-3">
        <header className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2">
          <button type="button" onClick={onBackHome} aria-label="Назад" title="Назад" className="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-xl font-black text-indigo-700 shadow-sm transition hover:bg-indigo-50 sm:h-12 sm:w-12 sm:text-2xl">←</button>
          <div className="flex min-w-0 justify-center">
            <button type="button" onClick={handleHintClick} disabled={isFinished} className="min-w-[8.5rem] rounded-2xl border-2 border-blue-100 bg-blue-50 px-5 py-2 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-100 disabled:opacity-50 sm:min-w-[10rem] sm:px-6 sm:text-base">{gameState.loadingHint ? '...' : 'Подсказка'}</button>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleRulesClick} aria-label="Правила Wordle" title="Правила" className="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-indigo-50 font-black text-indigo-700 shadow-sm transition hover:bg-indigo-100 sm:h-12 sm:w-12">?</button>
            <button type="button" onClick={onRestart} aria-label="Новая игра" title="Новая игра" className="flex h-10 w-10 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-indigo-50 text-xl font-black text-indigo-700 shadow-sm transition hover:bg-indigo-100 sm:h-12 sm:w-12 sm:text-2xl">↻</button>
          </div>
        </header>

        {showRules && (
          <div className="absolute right-0 top-12 z-30 w-[min(21rem,92vw)] rounded-3xl border-2 border-indigo-100 bg-white p-4 text-sm text-indigo-950 shadow-2xl sm:top-14">
            <div className="mb-3 flex items-center justify-between gap-3"><div className="font-black">Как играть</div><button type="button" onClick={() => { setShowRules(false); blurActiveElement(); }} className="font-black text-indigo-400">×</button></div>
            <div className="space-y-3 font-bold"><p>Соберите слово за 6 попыток.</p><div className="flex items-center gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500 text-lg font-black text-white">A</span><span>буква на правильном месте</span></div><div className="flex items-center gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500 text-lg font-black text-white">B</span><span>буква есть в слове, но место другое</span></div><div className="flex items-center gap-2"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-500 text-lg font-black text-white">C</span><span>буквы нет в слове</span></div></div>
          </div>
        )}

        {showHint && (
          <div className="absolute left-1/2 top-12 z-30 w-[min(21rem,92vw)] -translate-x-1/2 rounded-3xl border-2 border-blue-100 bg-white p-4 text-sm text-blue-950 shadow-2xl sm:top-14">
            <div className="flex items-start justify-between gap-3"><div className="font-bold">{gameState.loadingHint ? 'Готовлю подсказку...' : gameState.hint || 'Подсказка скоро появится.'}</div><button type="button" onClick={closeHint} className="font-black text-blue-400">×</button></div>
          </div>
        )}

        <section className="flex min-h-0 items-center justify-center overflow-hidden rounded-[1.5rem] border-2 border-indigo-50 bg-white/85 px-2 py-2 shadow-sm sm:rounded-[2rem] sm:px-4 lg:bg-transparent lg:border-0 lg:shadow-none lg:px-0">
          <Grid guesses={gameState.guesses} currentGuess={gameState.currentGuess} secretWord={gameState.secretWord} wordLength={settings.wordLength} maxGuesses={6} shakeRowIndex={shakeRowIndex} />
        </section>

        <footer className="flex shrink-0 justify-center overflow-hidden pb-[max(0.15rem,env(safe-area-inset-bottom))]"><Keyboard onChar={onChar} onDelete={onDelete} onEnter={onEnter} letterStatuses={keyStatuses} /></footer>

        {isFinished && (
          <div className={`absolute left-1/2 top-[4.2rem] z-20 w-[min(30rem,92vw)] -translate-x-1/2 rounded-2xl border-2 px-3 py-2 text-center shadow-lg ${gameState.gameStatus === 'won' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
            <span className="text-sm font-black">{gameState.gameStatus === 'won' ? 'Победа' : 'Слово'}: {gameState.secretWord}</span>{gameState.secretWordData?.translation && <span className="ml-2 text-xs opacity-80">{gameState.secretWordData.translation}</span>}
          </div>
        )}
      </div>

      {isFinished && rewardPreview && progressPreview && (
        <GameResultOverlay
          isOpen={isFinished}
          status={gameState.gameStatus === 'won' ? 'won' : 'lost'}
          title={gameState.gameStatus === 'won' ? 'Победа!' : 'Почти получилось'}
          subtitle={gameState.gameStatus === 'won' ? 'Слово угадано.' : 'Попробуем ещё раз?'}
          emoji={gameState.gameStatus === 'won' ? '🎉' : '💪'}
          pet={progressPreview.pet}
          xpGained={rewardPreview.xp}
          coinsGained={rewardPreview.coins}
          onPrimary={onRestart}
          onSecondary={onBackHome}
          details={<span>Слово: <span className="font-black">{gameState.secretWord}</span>{gameState.secretWordData?.translation ? ` · ${gameState.secretWordData.translation}` : ''}{hintCoinsSpent > 0 ? ` · подсказки: −${hintCoinsSpent} 🪙` : ''}</span>}
        />
      )}
    </ScreenContainer>
  );
};