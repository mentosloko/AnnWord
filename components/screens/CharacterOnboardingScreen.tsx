import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { STARTER_CHARACTERS, createStarterCharacter } from '../../services/characterCatalog';
import { PetState } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';

interface CharacterOnboardingScreenProps {
  onComplete: (character: PetState) => Promise<void> | void;
}

const VISIBLE_STARTER_CHARACTERS = STARTER_CHARACTERS.filter(character => character.type === 'Puppy');
const normalizeCharacterName = (value: string) => value.trim().replace(/\s+/g, ' ');

export const CharacterOnboardingScreen: React.FC<CharacterOnboardingScreenProps> = ({ onComplete }) => {
  const starterCharacters = VISIBLE_STARTER_CHARACTERS.length > 0 ? VISIBLE_STARTER_CHARACTERS : [STARTER_CHARACTERS[0]];
  const [selectedType, setSelectedType] = useState(starterCharacters[0].type);
  const selectedCharacter = useMemo(
    () => starterCharacters.find(character => character.type === selectedType) || starterCharacters[0],
    [selectedType, starterCharacters],
  );
  const [characterName, setCharacterName] = useState(selectedCharacter.defaultName);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const normalizedName = normalizeCharacterName(characterName);

  const handleSelect = (type: string) => {
    const nextCharacter = starterCharacters.find(character => character.type === type) || starterCharacters[0];
    setSelectedType(nextCharacter.type);
    setCharacterName(nextCharacter.defaultName);
    setError(null);
  };

  const handleComplete = async () => {
    if (isSaving) return;
    if (!normalizedName) { setError('Введите имя персонажа.'); return; }
    if (normalizedName.length > 16) { setError('Имя персонажа должно быть не длиннее 16 символов.'); return; }
    setIsSaving(true);
    setError(null);
    try {
      await onComplete(createStarterCharacter(selectedType, normalizedName));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer className="max-w-5xl pb-24">
      <section className="py-8 text-center">
        <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-600">
          Новый друг для слов
        </div>
        <h1 className="mb-4 text-4xl font-black text-indigo-950 sm:text-5xl">Твой персонаж</h1>
        <p className="mx-auto max-w-2xl text-lg text-gray-600">Он будет получать опыт за игры, расти и радоваться твоим успехам.</p>
      </section>

      <section className="mx-auto mb-8 grid max-w-sm grid-cols-1 gap-5" aria-label="Выбор персонажа">
        {starterCharacters.map(character => {
          const isSelected = selectedType === character.type;
          return (
            <motion.button key={character.type} type="button" aria-pressed={isSelected} whileHover={{ y: -4 }} whileTap={{ scale: 0.98 }} onClick={() => handleSelect(character.type)} className={`rounded-[2rem] border-4 bg-white p-6 text-center shadow-sm transition-all ${isSelected ? 'border-indigo-500 shadow-xl shadow-indigo-100' : 'border-indigo-50 hover:border-indigo-200'}`}>
              <div className="mb-5 text-7xl" aria-hidden="true">{character.emoji}</div>
              <h2 className="mb-2 text-2xl font-black text-indigo-950">{character.title}</h2>
              <p className="text-sm leading-relaxed text-gray-500">{character.description}</p>
              {isSelected && <div className="mt-5 inline-flex rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white">выбран</div>}
            </motion.button>
          );
        })}
      </section>

      <section className="mx-auto max-w-xl rounded-[2rem] border-2 border-indigo-50 bg-white p-6 shadow-sm">
        <label htmlFor="character-name" className="mb-2 block text-sm font-black uppercase tracking-widest text-indigo-400">Как зовут персонажа?</label>
        <input id="character-name" value={characterName} onChange={event => { setCharacterName(event.target.value); setError(null); }} maxLength={16} aria-invalid={Boolean(error)} aria-describedby={error ? 'character-name-error' : 'character-name-help'} className="w-full rounded-2xl border-2 border-indigo-100 px-5 py-4 text-2xl font-black text-indigo-950 outline-none focus:border-indigo-500" placeholder={selectedCharacter.defaultName} />
        <p id="character-name-help" className="mt-2 text-xs font-bold text-gray-400">До 16 символов.</p>
        {error && <p id="character-name-error" role="alert" aria-live="assertive" className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}
        <button type="button" disabled={isSaving} onClick={handleComplete} className="mt-5 w-full rounded-2xl bg-indigo-600 py-4 text-xl font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-60">
          {isSaving ? 'Сохраняю...' : 'Начать приключение'}
        </button>
      </section>
    </ScreenContainer>
  );
};
