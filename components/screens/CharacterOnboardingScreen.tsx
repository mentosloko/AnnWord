import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { STARTER_CHARACTERS, createStarterCharacter } from '../../services/characterCatalog';
import { PetState } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';

interface CharacterOnboardingScreenProps {
  onComplete: (character: PetState) => Promise<void> | void;
}

const VISIBLE_STARTER_CHARACTERS = STARTER_CHARACTERS.filter(character => character.type === 'Puppy');

export const CharacterOnboardingScreen: React.FC<CharacterOnboardingScreenProps> = ({ onComplete }) => {
  const starterCharacters = VISIBLE_STARTER_CHARACTERS.length > 0 ? VISIBLE_STARTER_CHARACTERS : [STARTER_CHARACTERS[0]];
  const [selectedType, setSelectedType] = useState(starterCharacters[0].type);
  const selectedCharacter = useMemo(
    () => starterCharacters.find(character => character.type === selectedType) || starterCharacters[0],
    [selectedType, starterCharacters],
  );
  const [characterName, setCharacterName] = useState(selectedCharacter.defaultName);
  const [isSaving, setIsSaving] = useState(false);

  const handleSelect = (type: string) => {
    const nextCharacter = starterCharacters.find(character => character.type === type) || starterCharacters[0];
    setSelectedType(nextCharacter.type);
    setCharacterName(nextCharacter.defaultName);
  };

  const handleComplete = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onComplete(createStarterCharacter(selectedType, characterName));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer className="max-w-5xl pb-24">
      <section className="text-center py-8">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-4 py-2 text-xs font-black text-indigo-600 uppercase tracking-widest mb-5">
          Новый друг для слов
        </div>
        <h1 className="text-4xl sm:text-5xl font-black text-indigo-950 mb-4">Твой персонаж</h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Он будет получать опыт за игры, расти и радоваться твоим успехам.
        </p>
      </section>

      <section className="mx-auto grid max-w-sm grid-cols-1 gap-5 mb-8">
        {starterCharacters.map(character => {
          const isSelected = selectedType === character.type;
          return (
            <motion.button
              key={character.type}
              type="button"
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleSelect(character.type)}
              className={`rounded-[2rem] p-6 text-center border-4 bg-white shadow-sm transition-all ${
                isSelected ? 'border-indigo-500 shadow-xl shadow-indigo-100' : 'border-indigo-50 hover:border-indigo-200'
              }`}
            >
              <div className="text-7xl mb-5">{character.emoji}</div>
              <h2 className="text-2xl font-black text-indigo-950 mb-2">{character.title}</h2>
              <p className="text-sm text-gray-500 leading-relaxed">{character.description}</p>
              {isSelected && (
                <div className="mt-5 inline-flex rounded-full bg-indigo-600 px-4 py-1.5 text-xs font-black uppercase tracking-widest text-white">
                  выбран
                </div>
              )}
            </motion.button>
          );
        })}
      </section>

      <section className="mx-auto max-w-xl rounded-[2rem] bg-white border-2 border-indigo-50 shadow-sm p-6">
        <label className="block text-sm font-black uppercase tracking-widest text-indigo-400 mb-2">
          Как зовут персонажа?
        </label>
        <input
          value={characterName}
          onChange={event => setCharacterName(event.target.value)}
          maxLength={16}
          className="w-full rounded-2xl border-2 border-indigo-100 px-5 py-4 text-2xl font-black text-indigo-950 outline-none focus:border-indigo-500"
          placeholder={selectedCharacter.defaultName}
        />
        <button
          type="button"
          disabled={isSaving}
          onClick={handleComplete}
          className="mt-5 w-full rounded-2xl bg-indigo-600 py-4 text-xl font-black text-white shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition disabled:opacity-60"
        >
          {isSaving ? 'Сохраняю...' : 'Начать приключение'}
        </button>
      </section>
    </ScreenContainer>
  );
};