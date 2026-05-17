import React, { useState } from 'react';
import { CharStatus, GameState, GameSettings, UserProfile } from '../../types';
import { MAX_GUESSES } from '../../constants';
import { calculateGameReward } from '../../services/gamificationRules';
import { CharacterProgressCard } from '../CharacterProgressCard';
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

  return (
    <ScreenContainer className="max-w-5xl pb-28">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
        <button
          type="button"
          onClick={onBackHome}
          className="w-fit rounded-xl bg-white border-2 border-indigo-100 px-4 py-2 font-bold text-indigo-700 hover:bg-indigo-50 transition"
        >
          ← На главный экран
        </button>
        <div className="flex items-center gap-3 sm:text-center">
          <div>
            <div className="text-xs font-black text-indigo-300 uppercase tracking-widest">Classic</div>
            <h1 className="text-2xl font-black text-indigo-950">Угадай слово</h1>
          </div>
          <button
            type="button"
            onClick={() => setShowRules(prev => !prev)}
            aria-label="Правила Wordle"
            title="Правила режима"
            className="h-10 w-10 rounded-2xl bg-indigo-50 border-2 border-indigo-100 text-indigo-700 font-black hover:bg-indigo-100 transition"
          >
            ?
          </button>
        </div>
        <button
          type="button"
          onClick={onRestart}
          className="w-fit rounded-xl bg-indigo-50 px-4 py-2 font-bold text-indigo-700 hover:bg-indigo-100 transition"
        >
          Новая игра
        </button>
      </div>

      {showRules && (
        <div className="mb-5 rounded-3xl border-2 border-indigo-100 bg-indigo-50 px-5 py-4 text-sm text-indigo-900">
          <div className="font-black mb-2">Как играть и получать XP</div>
          <ul className="space-y-1 list-disc pl-5">
            {WORDLE_RULES.map(rule => <li key={rule}>{rule}</li>)}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5 lg:gap-6 items-start">
        <div className="rounded-[2rem] bg-white border-2 border-indigo-50 shadow-sm p-3 sm:p-6 flex flex-col items-center overflow-hidden">
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
          <div className="grid grid-cols-3 lg:grid-cols-1 gap-4">
            <div>
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Попытки</div>
              <div className="text-2xl font-black text-indigo-950">{gameState.guesses.length}/{MAX_GUESSES}</div>
            </div>
            <div>
              <div className="text-xs font-black text-gray-400 uppercase tracking-widest mb-1">Длина</div>
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
                {gameState.gameStatus === 'won' ? 'Победа' : 'Почти получилось'}
              </div>
              <div className="text-2xl font-black">{gameState.secretWord}</div>
              {gameState.secretWordData?.translation && (
                <div className="text-sm mt-1 opacity-80">{gameState.secretWordData.translation}</div>
              )}
            </div>
          )}

          {isFinished && rewardPreview && (
            <div className="mt-5">
              <CharacterProgressCard
                pet={userProfile.pet}
                xpGained={rewardPreview.xp}
                coinsGained={rewardPreview.coins}
              />
            </div>
          )}
        </aside>
      </div>

      <div className="mt-6 flex justify-center overflow-x-hidden">
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