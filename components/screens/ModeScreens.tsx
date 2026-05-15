import React from 'react';
import { AnagramGame } from '../AnagramGame';
import { SprintGame } from '../SprintGame';
import { MemoryGame } from '../MemoryGame';
import { HangmanGame } from '../HangmanGame';
import { GameModeShell } from './GameModeShell';
import { GUEST_PROFILE } from '../../constants/profileDefaults';
import { UserProfile } from '../../types';

interface ModeScreenProps {
  words: string[];
  userProfile?: UserProfile;
  onWin: (amount: number) => void | Promise<void>;
  onBackHome: () => void;
}

const buildModeProfile = (userProfile: UserProfile | undefined, words: string[]): UserProfile => ({
  ...(userProfile || GUEST_PROFILE),
  customDictionaryEn: words,
});

const noopAddXP = () => undefined;

export const AnagramsScreen: React.FC<ModeScreenProps> = ({ words, userProfile, onWin, onBackHome }) => (
  <GameModeShell title="Анаграммы" subtitle="Собери слово" onBackHome={onBackHome}>
    <AnagramGame userProfile={buildModeProfile(userProfile, words)} onWinCoins={onWin} onAddXP={noopAddXP} onBack={onBackHome} />
  </GameModeShell>
);

export const SprintScreen: React.FC<ModeScreenProps> = ({ words, userProfile, onWin, onBackHome }) => (
  <GameModeShell title="Спринт" subtitle="Быстрый режим" onBackHome={onBackHome}>
    <SprintGame userProfile={buildModeProfile(userProfile, words)} onWinCoins={onWin} onAddXP={noopAddXP} onBack={onBackHome} />
  </GameModeShell>
);

export const MemoryScreen: React.FC<ModeScreenProps> = ({ words, userProfile, onWin, onBackHome }) => (
  <GameModeShell title="Память" subtitle="Найди пары" onBackHome={onBackHome}>
    <MemoryGame userProfile={buildModeProfile(userProfile, words)} onWinCoins={onWin} onAddXP={noopAddXP} onBack={onBackHome} />
  </GameModeShell>
);

export const HangmanScreen: React.FC<ModeScreenProps> = ({ words, userProfile, onWin, onBackHome }) => (
  <GameModeShell title="Виселица" subtitle="Угадай по буквам" onBackHome={onBackHome}>
    <HangmanGame userProfile={buildModeProfile(userProfile, words)} onWinCoins={onWin} onAddXP={noopAddXP} onBack={onBackHome} />
  </GameModeShell>
);
