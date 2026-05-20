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
    <ScreenContainer className="max-w-5xl min-h-[100dvh] py-2 pb-2 sm:py-4 sm:pb-4">
      <div className="flex min-h-[calc(100dvh-1rem)] sm:min-h-[calc(100dvh-2rem)] flex-col gap-2 sm:gap-4">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={onBackHome}
            className="rounded-xl bg-white border-2 border-indigo-100 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-base font-bold text-indigo-700 hover:bg-indigo-50 transition"
          >
            ← Главная
          </button>
          <div className="flex items-center gap-2 sm:gap-3 text-center min-w-0">
            <div className="min-w-0">
              <div className="hidden sm:block text-xs font-black text-indigo-300 uppercase tracking-widest">Classic</div>
              <h1 className="text-base sm:text-2xl font-black text-indigo-950 truncate">Угадай слово</h1>
            </div>
            <button
              type="button"
              onClick={() => setShowRules(prev => !prev)}
              aria-label="Правила Wordle"
              title="Правила режима"
              className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-2xl bg-indigo-50 border-2 border-indigo-100 text-indigo-700 font-black hover:bg-indigo-100 transition"
            >
              ?
            </button>
          </div>
          <button
            type="button"
            onClick={onRestart}
            className="rounded-xl bg-indigo-50 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-base font-bold text-indigo-700 hover:bg-indigo-100 transition"
          >
            Новая
          </button>
        </div>

        {showRules && (
          <div className="shrink-0 rounded-2xl sm:rounded-3xl border-2 border-indigo-100 bg-indigo-50 px-4 py-3 text-xs sm:text-sm text-indigo-900">
            <div className="font-black mb-1">Как играть и получать XP</div>
            <ul className="space-y-0.5 list-disc pl-5">
              {WORDLE_RULES.map(rule => <li key={rule}>{rule}</li>)}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-2 sm:gap-4 lg:gap-6 items-stretch min-h-0 flex-1">
          <div className="rounded-[1.5rem] sm:rounded-[2rem] bg-white border-2 border-indigo-50 shadow-sm p-2 sm:p-4 flex flex-col items-center justify-center overflow-hidden min-h-0">
            {gameState.error && (
              <div className="mb-1 sm:mb-3 rounded-2xl bg-red-50 border border-red-100 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-red-600 shrink-0">
                {gameState.error}
              </div>
            )}

            <Grid
              guesses={gameState.guesses}
              currentGuess={gameState.currentGuess}
              secretWord={gameState.secretWord}
              wordLength={settings.wordLength}
              maxGuesses={MAX_GUESSES}
              shakeRowIndex={shakeRowIndex}
            />

            {gameState.hint && (
              <div className="mt-2 sm:mt-3 rounded-2xl bg-blue-50 border border-blue-100 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold text-blue-700 shrink-0">
                {gameState.hint}
              </div>
            )}
          </div>

          <aside className="rounded-[1.5rem] sm:rounded-[2rem] bg-white border-2 border-indigo-50 shadow-sm p-3 sm:p-5 shrink-0">
            <div className="grid grid-cols-4 lg:grid-cols-1 gap-2 sm:gap-4 items-center">
              <div>
                <div className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-0.5 sm:mb-1">Попытки</div>
                <div className="text-base sm:text-2xl font-black text-indigo-950">{gameState.guesses.length}/{MAX_GUESSES}</div>
              </div>
              <div>
                <div className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-0.5 sm:mb-1">Длина</div>
                <div className="text-base sm:text-2xl font-black text-indigo-950">{settings.wordLength}</div>
              </div>
              <div>
                <div className="text-[10px] sm:text-xs font-black text-gray-400 uppercase tracking-widest mb-0.5 sm:mb-1">Уровень</div>
                <div className="text-base sm:text-2xl font-black text-indigo-950 truncate">{settings.difficulty}</div>
              </div>
              <button
                type="button"
                onClick={onHint}
                disabled={gameState.loadingHint || isFinished}
                className="w-full rounded-2xl bg-blue-50 border-2 border-blue-100 px-2 sm:px-4 py-2 sm:py-3 text-xs sm:text-base font-black text-blue-700 hover:bg-blue-100 transition disabled:opacity-50"
              >
                {gameState.loadingHint ? '...' : 'Подсказка'}
              </button>
            </div>

            {isFinished && (
              <div className={`mt-2 sm:mt-5 rounded-2xl p-3 sm:p-4 border-2 ${gameState.gameStatus === 'won' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
                <div className="text-xs sm:text-sm font-black uppercase tracking-widest mb-1">
                  {gameState.gameStatus === 'won' ? 'Победа' : 'Почти получилось'}
                </div>
                <div className="text-xl sm:text-2xl font-black">{gameState.secretWord}</div>
                {gameState.secretWordData?.translation && (
                  <div className="text-xs sm:text-sm mt-1 opacity-80">{gameState.secretWordData.translation}</div>
                )}
              </div>
            )}
          </aside>
        </div>

        <div className="flex justify-center overflow-x-hidden shrink-0">
          <Keyboard
            onChar={onChar}
            onDelete={onDelete}
            onEnter={onEnter}
            letterStatuses={keyStatuses}
          />
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