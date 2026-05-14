import React from 'react';
import { CharStatus, GameState, GameSettings } from '../../types';
import { MAX_GUESSES } from '../../constants';
import { Grid } from '../Grid';
import { Keyboard } from '../Keyboard';
import { ScreenContainer } from '../layout/ScreenContainer';

interface ClassicGameScreenProps {
  gameState: GameState;
  settings: GameSettings;
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
  keyStatuses,
  shakeRowIndex,
  onChar,
  onDelete,
  onEnter,
  onHint,
  onRestart,
  onBackHome,
}) => {
  const isFinished = gameState.gameStatus === 'won' || gameState.gameStatus === 'lost';

  return (
    <ScreenContainer className="max-w-5xl pb-28">
      <div className="flex items-center justify-between gap-4 mb-5">
        <button
          type="button"
          onClick={onBackHome}
          className="rounded-xl bg-white border-2 border-indigo-100 px-4 py-2 font-bold text-indigo-700 hover:bg-indigo-50 transition"
        >
          ← На главный экран
        </button>
        <div className="text-center">
          <div className="text-xs font-black text-indigo-300 uppercase tracking-widest">Classic</div>
          <h1 className="text-2xl font-black text-indigo-950">Угадай слово</h1>
        </div>
        <button
          type="button"
          onClick={onRestart}
          className="rounded-xl bg-indigo-50 px-4 py-2 font-bold text-indigo-700 hover:bg-indigo-100 transition"
        >
          Новая игра
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6 items-start">
        <div className="rounded-[2rem] bg-white border-2 border-indigo-50 shadow-sm p-4 sm:p-6 flex flex-col items-center">
          {gameState.error && (
            <div className="mb-4 rounded-2xl bg-red-50 border border-red-100 px-4 py-2 text-sm font-bold text-red-600">
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
            <div className="mt-4 rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3 text-sm font-bold text-blue-700">
              {gameState.hint}
            </div>
          )}
        </div>

        <aside className="rounded-[2rem] bg-white border-2 border-indigo-50 shadow-sm p-5">
          <div className="space-y-4">
            <div>
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Попытки</div>
              <div className="text-2xl font-black text-indigo-950">{gameState.guesses.length}/{MAX_GUESSES}</div>
            </div>
            <div>
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Длина слова</div>
              <div className="text-2xl font-black text-indigo-950">{settings.wordLength}</div>
            </div>
            <div>
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Уровень</div>
              <div className="text-2xl font-black text-indigo-950">{settings.difficulty}</div>
            </div>
          </div>

          <button
            type="button"
            onClick={onHint}
            disabled={gameState.loadingHint || isFinished}
            className="mt-6 w-full rounded-2xl bg-blue-50 border-2 border-blue-100 px-4 py-3 font-black text-blue-700 hover:bg-blue-100 transition disabled:opacity-50"
          >
            {gameState.loadingHint ? 'Ищу подсказку...' : 'Подсказка'}
          </button>

          {isFinished && (
            <div className={`mt-5 rounded-2xl p-4 border-2 ${gameState.gameStatus === 'won' ? 'bg-green-50 border-green-100 text-green-800' : 'bg-red-50 border-red-100 text-red-800'}`}>
              <div className="text-sm font-black uppercase tracking-widest mb-1">
                {gameState.gameStatus === 'won' ? 'Победа' : 'Игра окончена'}
              </div>
              <div className="text-2xl font-black">{gameState.secretWord}</div>
              {gameState.secretWordData?.translation && (
                <div className="text-sm mt-1 opacity-80">{gameState.secretWordData.translation}</div>
              )}
            </div>
          )}
        </aside>
      </div>

      <div className="mt-6 flex justify-center">
        <Keyboard
          onChar={onChar}
          onDelete={onDelete}
          onEnter={onEnter}
          letterStatuses={keyStatuses}
        />
      </div>
    </ScreenContainer>
  );
};
