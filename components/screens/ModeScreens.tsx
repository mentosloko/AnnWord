import React from 'react';
import { AnagramGame } from '../AnagramGame';
import { SprintGame } from '../SprintGame';
import { MemoryGame } from '../MemoryGame';
import { HangmanGame } from '../HangmanGame';
import { GameModeShell } from './GameModeShell';
import { GUEST_PROFILE } from '../../constants/profileDefaults';
import { UserProfile } from '../../types';
import { GameRewardInput } from '../../services/gamificationRules';

interface ModeScreenProps {
  words: string[];
  userProfile?: UserProfile;
  onGameReward: (input: GameRewardInput) => void | Promise<void>;
  onBackHome: () => void;
}

const buildModeProfile = (userProfile: UserProfile | undefined, words: string[]): UserProfile => ({
  ...(userProfile || GUEST_PROFILE),
  customDictionaryEn: words,
});

const MODE_RULES = {
  anagrams: [
    'Собирайте слово из перемешанных букв.',
    'За каждое угаданное слово начисляется XP.',
    'Даже короткая попытка помогает тренировке словаря.',
  ],
  sprint: [
    'Выбирайте правильные ответы как можно быстрее.',
    'XP зависит от количества правильных ответов.',
    'Монеты начисляются за серию правильных ответов.',
  ],
  memory: [
    'Открывайте карточки и находите пары слово–перевод.',
    'Победа в Мемо даёт повышенный XP: лучше результат — больше опыта.',
    'Игра тренирует узнавание слова и перевод, а не только скорость.',
  ],
  hangman: [
    'Угадывайте слово по буквам до окончания попыток.',
    'Победа даёт больше XP, но за завершённую попытку тоже есть Pity XP.',
    'Ошибки не отнимают XP, монеты или настроение.',
  ],
};

export const AnagramsScreen: React.FC<ModeScreenProps> = ({ words, userProfile, onGameReward, onBackHome }) => (
  <GameModeShell title="Анаграммы" subtitle="Собери слово" rules={MODE_RULES.anagrams} onBackHome={onBackHome}>
    <AnagramGame userProfile={buildModeProfile(userProfile, words)} onGameReward={onGameReward} onBack={onBackHome} />
  </GameModeShell>
);

export const SprintScreen: React.FC<ModeScreenProps> = ({ words, userProfile, onGameReward, onBackHome }) => (
  <GameModeShell title="Спринт" subtitle="Быстрый режим" rules={MODE_RULES.sprint} onBackHome={onBackHome}>
    <SprintGame userProfile={buildModeProfile(userProfile, words)} onGameReward={onGameReward} onBack={onBackHome} />
  </GameModeShell>
);

export const MemoryScreen: React.FC<ModeScreenProps> = ({ words, userProfile, onGameReward, onBackHome }) => (
  <GameModeShell title="Память" subtitle="Найди пары" rules={MODE_RULES.memory} onBackHome={onBackHome}>
    <MemoryGame userProfile={buildModeProfile(userProfile, words)} onGameReward={onGameReward} onBack={onBackHome} />
  </GameModeShell>
);

export const HangmanScreen: React.FC<ModeScreenProps> = ({ words, userProfile, onGameReward, onBackHome }) => (
  <GameModeShell title="Виселица" subtitle="Угадай по буквам" rules={MODE_RULES.hangman} onBackHome={onBackHome}>
    <HangmanGame userProfile={buildModeProfile(userProfile, words)} onGameReward={onGameReward} onBack={onBackHome} />
  </GameModeShell>
);