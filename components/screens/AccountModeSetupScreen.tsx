import React, { useState } from 'react';
import { AccountMode } from '../../types';
import { ScreenContainer } from '../layout/ScreenContainer';

interface AccountModeSetupScreenProps {
  onSelectMode: (mode: AccountMode) => Promise<void>;
}

const OPTIONS: Array<{ mode: AccountMode; icon: string; title: string; description: string; accent: string }> = [
  { mode: 'player', icon: '🎮', title: 'Самостоятельный игрок', description: 'Играю сам, выбираю питомца и изучаю слова.', accent: 'border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50' },
  { mode: 'parent', icon: '👨‍👩‍👧', title: 'Родитель', description: 'Создам профиль ребёнка и буду следить за прогрессом.', accent: 'border-purple-100 hover:border-purple-300 hover:bg-purple-50' },
  { mode: 'teacher', icon: '👩‍🏫', title: 'Преподаватель', description: 'Подключу учеников по коду и назначу им подборки слов.', accent: 'border-cyan-100 hover:border-cyan-300 hover:bg-cyan-50' },
];

export const AccountModeSetupScreen: React.FC<AccountModeSetupScreenProps> = ({ onSelectMode }) => {
  const [selected, setSelected] = useState<AccountMode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const choose = async (mode: AccountMode) => {
    setSelected(mode);
    setError(null);
    try { await onSelectMode(mode); }
    catch (problem: unknown) {
      setSelected(null);
      setError(problem instanceof Error ? problem.message : 'Не удалось сохранить выбор.');
    }
  };

  return <ScreenContainer className="max-w-2xl pb-20 pt-8">
    <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-6 shadow-sm sm:p-8">
      <div className="text-center text-xs font-black uppercase tracking-widest text-indigo-400">Добро пожаловать в AnnWord</div>
      <h1 className="mt-3 text-center text-3xl font-black text-indigo-950">Как вы будете пользоваться игрой?</h1>
      <p className="mx-auto mt-3 max-w-md text-center text-sm font-bold text-gray-500">Выберите подходящий сценарий. Для тестовой версии родитель может создать один профиль ребёнка.</p>
      {error && <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}
      <div className="mt-7 space-y-3">{OPTIONS.map(option => <button key={option.mode} type="button" disabled={selected !== null} onClick={() => void choose(option.mode)} className={`flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left transition disabled:opacity-60 ${option.accent}`}><span className="text-3xl" aria-hidden="true">{option.icon}</span><span className="min-w-0 flex-1"><span className="block text-lg font-black text-indigo-950">{option.title}</span><span className="mt-1 block text-sm font-bold text-gray-500">{option.description}</span></span><span className="text-xl font-black text-indigo-300">{selected === option.mode ? '…' : '→'}</span></button>)}</div>
    </section>
  </ScreenContainer>;
};
