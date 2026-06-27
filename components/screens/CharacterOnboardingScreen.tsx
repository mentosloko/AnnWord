import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { STARTER_CHARACTERS, createStarterCharacter } from '../../services/characterCatalog';
import { getPetCharacterAssetUrl } from '../../services/petAssets';
import { PetState } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';

interface CharacterOnboardingScreenProps {
  onComplete: (character: PetState) => Promise<void> | void;
  onOpenPremium?: () => void;
}

const VISIBLE_STARTER_CHARACTERS = STARTER_CHARACTERS.filter(character => character.type === 'Puppy');
const normalizeCharacterName = (value: string) => value.trim().replace(/\s+/g, ' ');

export const CharacterOnboardingScreen: React.FC<CharacterOnboardingScreenProps> = ({ onComplete, onOpenPremium }) => {
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
  const previewPet = useMemo(
    () => createStarterCharacter(selectedType, normalizedName || selectedCharacter.defaultName),
    [normalizedName, selectedCharacter.defaultName, selectedType],
  );
  const previewAssetUrl = getPetCharacterAssetUrl(previewPet);

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
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Не удалось сохранить питомца. Попробуйте ещё раз.');
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

        <div className="mx-auto mt-6 max-w-4xl rounded-[2rem] border-2 border-amber-100 bg-gradient-to-br from-amber-50 to-orange-50 p-4 shadow-sm sm:p-5">
          <div className="grid gap-4 md:grid-cols-[1.25fr_0.75fr] md:items-center">
            <div>
              <div className="inline-flex rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-widest text-amber-600 shadow-sm">AnnWord Premium</div>
              <h2 className="mt-3 text-2xl font-black leading-tight text-indigo-950">Больше слов и контроль для родителя с самого старта</h2>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {['Расширенные детские словари', 'Код для преподавателя', 'Назначение слов и отчёты'].map(item => <div key={item} className="rounded-2xl bg-white px-3 py-3 text-xs font-black leading-snug text-indigo-700 shadow-sm">{item}</div>)}
              </div>
            </div>
            <div className="flex flex-col gap-2 md:items-end">
              <div className="rounded-2xl bg-white px-4 py-3 text-center shadow-sm">
                <div className="text-lg font-black text-indigo-950">от 300 ₽</div>
                <div className="text-[11px] font-black uppercase tracking-widest text-gray-400">за месяц</div>
              </div>
              {onOpenPremium && <button type="button" onClick={onOpenPremium} className="w-full rounded-2xl bg-amber-500 px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-amber-600 md:w-auto">Посмотреть Premium</button>}
            </div>
          </div>
        </div>

        <div className={`mx-auto mt-7 grid max-w-4xl gap-5 ${hasChoice ? 'lg:grid-cols-[1fr_1.1fr]' : 'lg:grid-cols-[0.9fr_1.1fr]'}`}>
          <section className="rounded-[2rem] border-2 border-purple-50 bg-gradient-to-br from-purple-50 to-indigo-50 p-5 text-center">
            <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mx-auto flex h-44 w-44 items-center justify-center rounded-[2rem] bg-white shadow-inner sm:h-56 sm:w-56" aria-hidden="true">
              {previewAssetUrl ? <img src={previewAssetUrl} alt="" className="h-full w-full object-contain p-3" /> : <span className="text-8xl sm:text-9xl">{selectedCharacter.emoji}</span>}
            </motion.div>
            <h2 className="mt-5 text-2xl font-black text-indigo-950">{selectedCharacter.title}</h2>
            <p className="mx-auto mt-2 max-w-xs text-sm font-bold leading-relaxed text-gray-500">{selectedCharacter.description}</p>
            {!hasChoice && <div className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-indigo-500 shadow-sm">первый питомец</div>}
          </section>

          <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm">
            {hasChoice && <div className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Выбор питомца">
              {starterCharacters.map(character => {
                const isSelected = selectedType === character.type;
                const optionPet = createStarterCharacter(character.type, character.defaultName);
                const optionAssetUrl = getPetCharacterAssetUrl(optionPet);
                return <button key={character.type} type="button" aria-pressed={isSelected} onClick={() => handleSelect(character.type)} className={`rounded-2xl border-2 p-3 text-center transition ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-indigo-50 bg-white hover:border-indigo-200'}`}><div className="mx-auto flex h-12 w-12 items-center justify-center" aria-hidden="true">{optionAssetUrl ? <img src={optionAssetUrl} alt="" className="h-full w-full object-contain" /> : <span className="text-4xl">{character.emoji}</span>}</div><div className="mt-2 text-sm font-black text-indigo-950">{character.title}</div></button>;
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