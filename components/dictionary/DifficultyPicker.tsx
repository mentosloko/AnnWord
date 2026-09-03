import React, { useEffect, useMemo, useState } from 'react';
import type { DifficultyLevel, EnrichedWord } from '../../types';
import {
  buildDifficultyAvailability,
  difficultyUnavailableMessage,
  DIFFICULTY_LEVELS,
} from '../../services/difficultyAvailability';
import { ensureGeneralDictionaryLoaded, readGeneralDictionary } from '../../services/dictionaryRuntime';
import { getKidsCefrEntries } from '../../services/kidsCefrDictionary';

type DifficultyPickerProps = {
  value: DifficultyLevel;
  kidsMode: boolean;
  onChange: (difficulty: DifficultyLevel) => void;
  layout?: 'desktop' | 'mobile';
};

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

const labelFor = (level: DifficultyLevel): string => level === 'ALL' ? 'Все' : level;

export const DifficultyPicker: React.FC<DifficultyPickerProps> = ({
  value,
  kidsMode,
  onChange,
  layout = 'desktop',
}) => {
  const cachedGeneral = readGeneralDictionary()?.COMMON_WORDS_EN || null;
  const [generalEntries, setGeneralEntries] = useState<EnrichedWord[] | null>(cachedGeneral);
  const [loadState, setLoadState] = useState<LoadState>(cachedGeneral ? 'ready' : 'idle');

  useEffect(() => {
    const cached = readGeneralDictionary()?.COMMON_WORDS_EN || null;
    if (cached) {
      setGeneralEntries(cached);
      setLoadState('ready');
      return;
    }
    let cancelled = false;
    setLoadState('loading');
    void ensureGeneralDictionaryLoaded()
      .then(dictionary => {
        if (cancelled) return;
        setGeneralEntries(dictionary.COMMON_WORDS_EN);
        setLoadState('ready');
      })
      .catch(() => {
        if (!cancelled) setLoadState('error');
      });
    return () => { cancelled = true; };
  }, [kidsMode]);

  const entries = useMemo(
    () => kidsMode ? getKidsCefrEntries(generalEntries || []) : generalEntries || [],
    [generalEntries, kidsMode],
  );
  const availability = useMemo(() => buildDifficultyAvailability(entries), [entries]);
  const availabilityByLevel = useMemo(
    () => new Map(availability.map(item => [item.level, item])),
    [availability],
  );
  const ready = loadState === 'ready';
  const unavailableLevels = availability.filter(item => item.level !== 'ALL' && !item.available);

  if (layout === 'mobile') {
    return <div>
      {loadState === 'loading' && <p className="mb-3 rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700">Проверяю, какие уровни готовы для игр…</p>}
      {loadState === 'error' && <p role="alert" className="mb-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">Не удалось проверить переводы уровней. Попробуйте открыть выбор словаря ещё раз.</p>}
      <div className="grid grid-cols-2 gap-3">
        {DIFFICULTY_LEVELS.map(level => {
          const item = availabilityByLevel.get(level);
          const disabled = !ready || !item?.available;
          const selected = value === level;
          return <button
            type="button"
            key={level}
            disabled={disabled}
            aria-pressed={selected}
            aria-label={disabled && ready ? difficultyUnavailableMessage(level, kidsMode) : undefined}
            onClick={() => onChange(level)}
            className={`rounded-2xl border-2 p-4 text-left ${selected ? 'border-indigo-500 bg-indigo-50' : 'border-indigo-100 bg-white'} disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-50 disabled:opacity-65`}
          >
            <div className="flex items-center justify-between gap-2"><span className="text-xl font-black text-indigo-950">{labelFor(level)}</span>{disabled && ready && <span aria-hidden="true">🔒</span>}</div>
            <div className="mt-1 text-xs font-bold text-slate-500">{disabled && ready
              ? 'Пока недостаточно переведённых слов'
              : level === 'ALL'
                ? `${item?.playableCount || 0} игровых слов · все уровни`
                : `${item?.playableCount || 0} игровых слов · уровень ${level}`}</div>
          </button>;
        })}
      </div>
      {ready && unavailableLevels.length > 0 && <p className="mt-3 text-xs font-bold leading-5 text-slate-500">Недоступные уровни откроются, когда в них будет достаточно слов с русским переводом для стабильных раундов.</p>}
    </div>;
  }

  return <div>
    {loadState === 'loading' && <p className="mt-3 rounded-2xl bg-indigo-50 px-4 py-3 text-sm font-bold text-indigo-700">Проверяю, какие уровни готовы для игр…</p>}
    {loadState === 'error' && <p role="alert" className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">Не удалось проверить переводы уровней. Выбор уровня временно недоступен.</p>}
    <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7" role="group" aria-label="Уровень сложности">
      {DIFFICULTY_LEVELS.map(level => {
        const item = availabilityByLevel.get(level);
        const disabled = !ready || !item?.available;
        const selected = value === level;
        return <button
          type="button"
          key={level}
          disabled={disabled}
          aria-pressed={selected}
          aria-label={disabled && ready ? difficultyUnavailableMessage(level, kidsMode) : undefined}
          title={disabled && ready ? difficultyUnavailableMessage(level, kidsMode) : `${item?.playableCount || 0} игровых слов`}
          onClick={() => onChange(level)}
          className={`rounded-xl py-2.5 text-sm font-black ${selected ? 'bg-indigo-600 text-white' : 'border-2 border-indigo-100 bg-white text-indigo-700'} disabled:cursor-not-allowed disabled:border-slate-100 disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-75`}
        >{labelFor(level)}{disabled && ready ? ' 🔒' : ''}</button>;
      })}
    </div>
    {ready && unavailableLevels.length > 0 && <p className="mt-3 text-xs font-bold leading-5 text-slate-500">🔒 Недоступный уровень пока содержит меньше трёх подходящих игровых слов с русским переводом. Он не запускается, чтобы ребёнок не попадал на пустой экран.</p>}
  </div>;
};
