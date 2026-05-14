import React from 'react';
import { AnagramGame } from '../AnagramGame';
import { SprintGame } from '../SprintGame';
import { MemoryGame } from '../MemoryGame';
import { HangmanGame } from '../HangmanGame';
import { GameModeShell } from './GameModeShell';

interface ModeScreenProps {
  words: string[];
  onWin: (amount: number) => void | Promise<void>;
  onBackHome: () => void;
}

export const AnagramsScreen: React.FC<ModeScreenProps> = ({ words, onWin, onBackHome }) => (
  <GameModeShell title="Анаграммы" subtitle="Собери слово" onBackHome={onBackHome}>
    <AnagramGame words={words} onWin={onWin} onBack={onBackHome} />
  </GameModeShell>
);

export const SprintScreen: React.FC<ModeScreenProps> = ({ words, onWin, onBackHome }) => (
  <GameModeShell title="Спринт" subtitle="Быстрый режим" onBackHome={onBackHome}>
    <SprintGame words={words} onWin={onWin} onBack={onBackHome} />
  </GameModeShell>
);

export const MemoryScreen: React.FC<ModeScreenProps> = ({ words, onWin, onBackHome }) => (
  <GameModeShell title="Память" subtitle="Найди пары" onBackHome={onBackHome}>
    <MemoryGame words={words} onWin={onWin} onBack={onBackHome} />
  </GameModeShell>
);

export const HangmanScreen: React.FC<ModeScreenProps> = ({ words, onWin, onBackHome }) => (
  <GameModeShell title="Виселица" subtitle="Угадай по буквам" onBackHome={onBackHome}>
    <HangmanGame words={words} onWin={onWin} onBack={onBackHome} />
  </GameModeShell>
);
