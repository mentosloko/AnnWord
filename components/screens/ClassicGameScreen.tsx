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
  const rewardPreview = isFinished ? calculateGameReward({ type: 'wordle', won: gameState.gameStatus === 'won' }) : null;
  const progressPreview = rewardPreview ? applyGameRewardToCharacter(userProfile.pet, rewardPreview) : null;

  const handleHintClick = () => {
    setShowRules(false);
    setShowHint(true);
    if (!gameState.hint && !gameState.loadingHint) onHint();
  };

  const handleRulesClick = () => {
    setShowHint(false);
    setShowRules(prev => !prev);
  };

  return (
    <ScreenContainer className="max-w-2xl h-[100dvh] overflow-hidden px-2 pt-2 pb-1 sm:px-4 sm:py-4">
      <div className="relative flex h-full min-h-0 flex-col gap-1.5 sm:gap-3 overflow-hidden">
        <div className="flex items-center justify-between gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onBackHome}
            aria-label="Назад"
            title="Назад"
            className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-white border-2 border-indigo-100 text-xl sm:text-2xl font-black text-indigo-700 hover:bg-indigo-50 transition shadow-sm"
          >
            ←
          </button>

          <div className="flex min-w-0 flex-1 items-center justify-center">
            <button
              type="button"
              onClick={handleHintClick}
              disabled={isFinished}
              className="min-w-0 rounded-2xl bg-blue-50 border-2 border-blue-100 px-5 sm:px-6 py-2 text-sm sm:text-base font-black text-blue-700 hover:bg-blue-100 transition disabled:opacity-50 shadow-sm"
            >
              {gameState.loadingHint ? '...' : 'Подсказка'}
            </button>
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleRulesClick}
              aria-label="Правила Wordle"
              title="Правила"
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-indigo-50 border-2 border-indigo-100 text-indigo-700 font-black hover:bg-indigo-100 transition shadow-sm"
            >
              ?
            </button>
            <button
              type="button"
              onClick={onRestart}
              aria-label="Новая игра"
              title="Новая игра"
              className="h-10 w-10 sm:h-12 sm:w-12 rounded-2xl bg-indigo-50 border-2 border-indigo-100 text-xl sm:text-2xl font-black text-indigo-700 hover:bg-indigo-100 transition shadow-sm"
            >
              ↻
            </button>
          </div>
        </div>

        {showRules && (
          <div className="absolute right-0 top-12 sm:top-14 z-30 w-[min(21rem,92vw)] rounded-3xl border-2 border-indigo-100 bg-white p-4 text-sm text-indigo-950 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="font-black">Как играть</div>
              <button type="button" onClick={() => setShowRules(false)} className="font-black text-indigo-400">×</button>
            </div>
            <div className="space-y-3 font-bold">
              <p>Соберите слово за 6 попыток.</p>
              <div className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-500 text-lg font-black text-white">A</span>
                <span>буква на правильном месте</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500 text-lg font-black text-white">B</span>
                <span>буква есть в слове, но место другое</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-500 text-lg font-black text-white">C</span>
                <span>буквы нет в слове</span>
              </div>
            </div>
          </div>
        )}

        {showHint && (
          <div className="absolute left-1/2 top-12 sm:top-14 z-30 w-[min(21rem,92vw)] -translate-x-1/2 rounded-3xl border-2 border-blue-100 bg-white p-4 text-sm text-blue-950 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="font-bold">
                {gameState.loadingHint ? 'Готовлю подсказку...' : gameState.hint || 'Подсказка скоро появится.'}
              </div>
              <button type="button" onClick={() => setShowHint(false)} className="font-black text-blue-400">×</button>
            </div>
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col justify-start gap-1 sm:gap-2 pt-0.5 overflow-hidden">
          <div className="rounded-[1.35rem] sm:rounded-[2rem] bg-white border-2 border-indigo-50 shadow-sm p-1 sm:p-3 flex flex-col items-center justify-center overflow-hidden shrink-0">
            <Grid
              guesses={gameState.guesses}
              currentGuess={gameState.currentGuess}
              secretWord={gameState.secretWord}
              wordLength={settings.wordLength}
              maxGuesses={6}
              shakeRowIndex={shakeRowIndex}
            />
          </div>

          {isFinished && (
            <div className={`shrink-0 rounded-2xl px-3 py-2 border-2 text-center ${gameState.gameStatus === 'won' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
              <span className="text-sm font-black">{gameState.gameStatus === 'won' ? 'Победа' : 'Слово'}: {gameState.secretWord}</span>
              {gameState.secretWordData?.translation && (
                <span className="text-xs ml-2 opacity-80">{gameState.secretWordData.translation}</span>
              )}
            </div>
          )}

          <div className="flex justify-center overflow-x-hidden shrink-0 -mt-0.5 sm:mt-0">
            <Keyboard
              onChar={onChar}
              onDelete={onDelete}
              onEnter={onEnter}
              letterStatuses={keyStatuses}
            />
          </div>
        </div>
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
          details={(
            <span>
              Слово: <span className="font-black">{gameState.secretWord}</span>
              {gameState.secretWordData?.translation ? ` · ${gameState.secretWordData.translation}` : ''}
            </span>
          )}
        />
      )}
    </ScreenContainer>
  );
};