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
  const hasChoice = starterCharacters.length > 1;
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
    if (!normalizedName) { setError('Введите имя питомца.'); return; }
    if (normalizedName.length > 16) { setError('Имя питомца должно быть не длиннее 16 символов.'); return; }
    setIsSaving(true);
    setError(null);
    try {
      await onComplete(createStarterCharacter(selectedType, normalizedName));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer className="max-w-5xl pb-24 pt-6">
      <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm sm:p-8">
        <div className="mx-auto max-w-2xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-600">
            AnnWord Kids · последний шаг
          </div>
          <h1 className="text-3xl font-black leading-tight text-indigo-950 sm:text-5xl">Назовите питомца</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm font-bold leading-relaxed text-gray-600 sm:text-base">Он будет радоваться играм ребёнка, получать опыт и открывать новые элементы мотивации.</p>
        </div>

        <div className={`mx-auto mt-7 grid max-w-4xl gap-5 ${hasChoice ? 'lg:grid-cols-[1fr_1.1fr]' : 'lg:grid-cols-[0.9fr_1.1fr]'}`}>
          <section className="rounded-[2rem] border-2 border-purple-50 bg-gradient-to-br from-purple-50 to-indigo-50 p-5 text-center">
            <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mx-auto flex h-44 w-44 items-center justify-center rounded-[2rem] bg-white text-8xl shadow-inner sm:h-56 sm:w-56 sm:text-9xl" aria-hidden="true">
              {selectedCharacter.emoji}
            </motion.div>
            <h2 className="mt-5 text-2xl font-black text-indigo-950">{selectedCharacter.title}</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm font-bold leading-relaxed text-gray-500">{selectedCharacter.description}</p>
            {!hasChoice && <div className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-500 shadow-sm">первый питомец</div>}
          </section>

          <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm">
            {hasChoice && <div className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Выбор питомца">
              {starterCharacters.map(character => {
                const isSelected = selectedType === character.type;
                return <button key={character.type} type="button" aria-pressed={isSelected} onClick={() => handleSelect(character.type)} className={`rounded-2xl border-2 p-3 text-center transition ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-indigo-50 bg-white hover:border-indigo-200'}`}><div className="text-4xl" aria-hidden="true">{character.emoji}</div><div className="mt-2 text-sm font-black text-indigo-950">{character.title}</div></button>;
              })}
            </div>}

            <label htmlFor="character-name" className="mb-2 block text-sm font-black uppercase tracking-widest text-indigo-400">Имя питомца</label>
            <input id="character-name" value={characterName} onChange={event => { setCharacterName(event.target.value); setError(null); }} maxLength={16} aria-invalid={Boolean(error)} aria-describedby={error ? 'character-name-error' : 'character-name-help'} className="w-full rounded-2xl border-2 border-indigo-100 px-5 py-4 text-2xl font-black text-indigo-950 outline-none focus:border-indigo-500" placeholder={selectedCharacter.defaultName} />
            <p id="character-name-help" className="mt-2 text-xs font-bold text-gray-400">До 16 символов. Имя можно будет показывать ребёнку на главном экране.</p>
            {error && <p id="character-name-error" role="alert" aria-live="assertive" className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</p>}
            <button type="button" disabled={isSaving} onClick={handleComplete} className="mt-5 w-full rounded-2xl bg-indigo-600 py-4 text-xl font-black text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:opacity-60">
              {isSaving ? 'Сохраняю...' : 'Начать играть'}
            </button>
            <div className="mt-4 rounded-2xl bg-indigo-50 px-4 py-3 text-xs font-bold leading-relaxed text-indigo-700">Питомец помогает ребёнку возвращаться к словам, но взрослый управляет профилем и словарями из кабинета родителя.</div>
          </section>
        </div>
      </section>
    </ScreenContainer>
  );
};
