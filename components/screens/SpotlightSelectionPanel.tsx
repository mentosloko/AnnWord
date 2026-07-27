import React from 'react';
import type { GameSettings } from '../../types';
import {
  getSpotlightGradeCatalog,
  getSpotlightGradeMeta,
  getSpotlightSectionMeta,
  resolveSpotlightGrade,
  resolveSpotlightSectionId,
  SPOTLIGHT_ALL_SECTION_ID,
  SPOTLIGHT_DICTIONARY_ID,
} from '../../services/spotlightDictionaryCatalog';

interface SpotlightSelectionPanelProps {
  settings: GameSettings;
  onSettingsChange: (settings: GameSettings) => void;
  compact?: boolean;
}

export const SpotlightSelectionPanel: React.FC<SpotlightSelectionPanelProps> = ({ settings, onSettingsChange, compact = false }) => {
  const grade = resolveSpotlightGrade(settings.activeSpotlightGrade);
  const gradeMeta = getSpotlightGradeMeta(grade);
  const sectionId = resolveSpotlightSectionId(grade, settings.activeSpotlightSectionId);
  const selectedSection = getSpotlightSectionMeta(grade, sectionId);

  const chooseGrade = (nextGrade: number) => onSettingsChange({
    ...settings,
    dictionarySource: 'premium',
    useCustomDictionary: false,
    activePremiumDictionaryId: SPOTLIGHT_DICTIONARY_ID,
    activeSpotlightGrade: resolveSpotlightGrade(nextGrade),
    activeSpotlightSectionId: SPOTLIGHT_ALL_SECTION_ID,
  });

  const chooseSection = (nextSectionId: string) => onSettingsChange({
    ...settings,
    dictionarySource: 'premium',
    useCustomDictionary: false,
    activePremiumDictionaryId: SPOTLIGHT_DICTIONARY_ID,
    activeSpotlightGrade: grade,
    activeSpotlightSectionId: nextSectionId,
  });

  const optionClass = (active: boolean) => `rounded-2xl border-2 bg-white text-left transition ${
    compact ? 'p-3' : 'p-3.5'
  } ${active ? 'border-blue-400 shadow-sm' : 'border-transparent hover:border-blue-200'}`;

  return <div className={`${compact ? 'mt-3 rounded-2xl p-3' : 'mt-4 rounded-3xl p-4'} border-2 border-blue-100 bg-blue-50/70`}>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h3 className="font-black text-indigo-950">Spotlight по школьной программе</h3>
        <p className="mt-1 text-xs font-bold text-slate-500">Сначала выберите класс, затем весь класс или конкретный модуль.</p>
      </div>
      <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-blue-700">{gradeMeta.wordCount} слов</span>
    </div>

    <div className="mt-3 grid grid-cols-5 gap-2" role="group" aria-label="Класс Spotlight">
      {getSpotlightGradeCatalog().map(item => <button
        type="button"
        key={item.grade}
        aria-pressed={grade === item.grade}
        onClick={() => chooseGrade(item.grade)}
        className={`rounded-xl py-2 text-sm font-black ${grade === item.grade ? 'bg-blue-600 text-white' : 'bg-white text-blue-700 ring-1 ring-blue-100'}`}
      >{item.grade}</button>)}
    </div>

    <div className="mt-4">
      <div className="mb-2 text-[10px] font-black uppercase tracking-widest text-blue-500">Что тренировать</div>
      <button type="button" onClick={() => chooseSection(SPOTLIGHT_ALL_SECTION_ID)} className={`${optionClass(sectionId === SPOTLIGHT_ALL_SECTION_ID)} w-full`}>
        <div className="font-black text-indigo-950">Весь {grade} класс</div>
        <div className="mt-1 text-xs font-bold text-slate-500">{gradeMeta.wordCount} слов из всех разделов</div>
      </button>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {gradeMeta.modules.map(module => <button
          type="button"
          key={module.id}
          onClick={() => chooseSection(module.id)}
          className={optionClass(selectedSection?.id === module.id)}
        >
          <div className="text-sm font-black text-indigo-950">{module.label}</div>
          {module.title !== module.label && <div className="mt-1 line-clamp-2 text-xs font-bold text-slate-500">{module.title}</div>}
          <div className="mt-2 text-[11px] font-black text-blue-600">{module.wordCount} слов</div>
        </button>)}
      </div>

      {gradeMeta.supplements.length > 0 && <details className="mt-3 rounded-2xl bg-white/75 p-3">
        <summary className="cursor-pointer text-sm font-black text-indigo-800">Дополнительные разделы · {gradeMeta.supplements.length}</summary>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {gradeMeta.supplements.map(section => <button
            type="button"
            key={section.id}
            onClick={() => chooseSection(section.id)}
            className={optionClass(selectedSection?.id === section.id)}
          >
            <div className="text-sm font-black text-indigo-950">{section.label}</div>
            {section.title !== section.label && <div className="mt-1 line-clamp-2 text-xs font-bold text-slate-500">{section.title}</div>}
            <div className="mt-2 text-[11px] font-black text-blue-600">{section.wordCount} слов</div>
          </button>)}
        </div>
      </details>}
    </div>
  </div>;
};
