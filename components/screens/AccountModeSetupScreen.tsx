import React, { useEffect, useRef, useState } from 'react';
import { AccountMode } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';

interface AccountModeSetupScreenProps {
  onSelectMode: (mode: AccountMode) => Promise<void>;
  suggestedMode?: AccountMode | null;
}

const getModeFromCurrentPath = (): AccountMode | null => {
  if (typeof window === 'undefined') return null;
  const audience = new URLSearchParams(window.location.search).get('audience');
  if (audience === 'practice') return 'player';
  if (audience === 'kids') return 'parent';
  if (audience === 'teacher') return 'teacher';
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/practice') return 'player';
  if (path === '/kids') return 'parent';
  if (path === '/teacher') return 'teacher';
  return null;
};

const getModeTitle = (mode: AccountMode): string => mode === 'teacher'
  ? 'кабинет преподавателя'
  : mode === 'parent'
    ? 'детский профиль'
    : 'существующий профиль';

export const AccountModeSetupScreen: React.FC<AccountModeSetupScreenProps> = ({ onSelectMode, suggestedMode }) => {
  const targetModeRef = useRef<AccountMode>(suggestedMode || getModeFromCurrentPath() || 'parent');
  const autoSelectStartedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const choose = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try { await onSelectMode(targetModeRef.current); }
    catch (problem: unknown) { setError(problem instanceof Error ? problem.message : 'Не удалось сохранить настройку аккаунта.'); }
    finally { setSaving(false); }
  };

  useEffect(() => {
    if (autoSelectStartedRef.current) return;
    autoSelectStartedRef.current = true;
    void choose();
  }, []);

  return <ScreenContainer className="max-w-2xl pb-20 pt-16"><section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-8 text-center shadow-sm"><div className="mx-auto h-16 w-16 animate-pulse rounded-3xl bg-indigo-100" /><h1 className="mt-5 text-2xl font-black text-indigo-950">Настраиваю {getModeTitle(targetModeRef.current)}</h1><p className="mt-3 text-sm font-bold leading-relaxed text-gray-500">Подбираю правильный домашний экран по тому, откуда был создан аккаунт.</p>{error && <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}{error && <button type="button" disabled={saving} onClick={() => void choose()} className="mt-4 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white transition hover:bg-indigo-700 disabled:opacity-60">{saving ? 'Повторяю…' : 'Повторить'}</button>}</section></ScreenContainer>;
};
