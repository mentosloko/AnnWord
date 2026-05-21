import React, { useState } from 'react';
import { CharStatus, GameState, GameSettings, UserProfile } from '../../types';
import { MAX_GUESSES } from '../../constants';
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

const WORDLE_RULES = [
  'Угадайте слово за несколько попыток.',
  'Зелёная буква стоит на правильном месте, жёлтая есть в слове, серая отсутствует.',
  'Победа даёт больше XP, но завершённая попытка тоже даёт Pity XP.',
  'Ошибки не отнимают XP, монеты или настроение.',
];

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
  const isFinished = gameState.gameStatus === 'won' || gameState.gameStatus === 'lost';
  const rewardPreview = isFinished ? calculateGameReward({ type: 'wordle', won: gameState.gameStatus === 'won' }) : null;
  const progressPreview = rewardPreview ? applyGameRewardToCharacter(userProfile.pet, rewardPreview) : null;

  return (
    <ScreenContainer className="max-w-2xl min-h-[100dvh] px-2 py-2 pb-1 sm:px-4 sm:py-4">
      <div className="flex min-h-[calc(100dvh-0.75rem)] sm:min-h-[calc(100dvh-2rem)] flex-col gap-1.5 sm:gap-3">
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

          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
            <div className="rounded-2xl bg-white border-2 border-indigo-100 px-3 py-2 text-xs sm:text-sm font-black text-indigo-800 shadow-sm">
              {settings.difficulty}
            </div>
            <div className="rounded-2xl bg-white border-2 border-indigo-100 px-3 py-2 text-xs sm:text-sm font-black text-indigo-800 shadow-sm">
              {gameState.guesses.length}/{MAX_GUESSES}
            </div>
            <button
              type="button"
              onClick={onHint}
              disabled={gameState.loadingHint || isFinished}
              className="min-w-0 rounded-2xl bg-blue-50 border-2 border-blue-100 px-3 sm:px-4 py-2 text-xs sm:text-sm font-black text-blue-700 hover:bg-blue-100 transition disabled:opacity-50 shadow-sm"
            >
              {gameState.loadingHint ? '...' : 'Подсказка'}
            </button>
          </div>

          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setShowRules(prev => !prev)}
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
          <div className="shrink-0 rounded-2xl border-2 border-indigo-100 bg-indigo-50 px-4 py-3 text-xs sm:text-sm text-indigo-900">
            <div className="font-black mb-1">Как играть</div>
            <ul className="space-y-0.5 list-disc pl-5">
              {WORDLE_RULES.map(rule => <li key={rule}>{rule}</li>)}
            </ul>
          </div>
        )}

        {gameState.error && (
          <div className="shrink-0 rounded-2xl bg-red-50 border border-red-100 px-3 py-2 text-xs sm:text-sm font-bold text-red-600 text-center">
            {gameState.error}
          </div>
        )}

        {gameState.hint && (
          <div className="shrink-0 rounded-2xl bg-blue-50 border border-blue-100 px-3 py-2 text-xs sm:text-sm font-bold text-blue-700 text-center">
            {gameState.hint}
          </div>
        )}

        <div className="flex min-h-0 flex-1 flex-col justify-end gap-1.5 sm:gap-3">
          <div className="rounded-[1.35rem] sm:rounded-[2rem] bg-white border-2 border-indigo-50 shadow-sm p-1.5 sm:p-3 flex flex-col items-center justify-center overflow-hidden min-h-0">
            <Grid
              guesses={gameState.guesses}
              currentGuess={gameState.currentGuess}
              secretWord={gameState.secretWord}
              wordLength={settings.wordLength}
              maxGuesses={MAX_GUESSES}
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