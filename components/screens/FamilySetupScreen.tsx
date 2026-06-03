import React, { useState } from 'react';
import { ChildSetupResult } from '../../services/familyAccountService';
import { ScreenContainer } from '../layout/ScreenContainer';

interface FamilySetupScreenProps {
  onCreateChild: (childName: string, parentPin: string) => Promise<ChildSetupResult>;
  onComplete: (result: ChildSetupResult) => void;
  onBackHome: () => void;
}

export const FamilySetupScreen: React.FC<FamilySetupScreenProps> = ({ onCreateChild, onComplete, onBackHome }) => {
  const [childName, setChildName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const submit = async () => {
    if (!childName.trim()) { setNotice('Укажите имя ребёнка.'); return; }
    if (!/^\d{4}$/.test(pin)) { setNotice('PIN должен состоять из 4 цифр.'); return; }
    if (pin !== confirmPin) { setNotice('PIN-коды не совпадают.'); return; }
    setIsSaving(true); setNotice(null);
    try {
      const result = await onCreateChild(childName, pin);
      onComplete(result);
    } catch (error: unknown) {
      setNotice(error instanceof Error ? error.message : 'Не удалось создать профиль ребёнка.');
    } finally { setIsSaving(false); }
  };

  return (
    <ScreenContainer className="max-w-lg pb-20">
      <button type="button" onClick={onBackHome} className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-indigo-100 bg-white text-2xl font-black text-indigo-700">←</button>
      <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-6 shadow-sm sm:p-8">
        <div className="text-xs font-black uppercase tracking-widest text-indigo-400">Для родителей</div>
        <h1 className="mt-2 text-3xl font-black text-indigo-950">Создайте профиль ребёнка</h1>
        <p className="mt-3 text-sm font-bold text-gray-500">В тестовой версии доступен один ребёнок. Питомца он выберет сам после создания профиля.</p>
        {notice && <div className="mt-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{notice}</div>}
        <label className="mt-6 block text-sm font-black text-indigo-950">Имя ребёнка
          <input value={childName} onChange={event => setChildName(event.target.value)} maxLength={40} placeholder="Например, Аня" className="mt-2 w-full rounded-xl border-2 border-indigo-100 px-4 py-3 font-bold" />
        </label>
        <label className="mt-4 block text-sm font-black text-indigo-950">PIN родительского кабинета
          <input value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" type="password" placeholder="4 цифры" className="mt-2 w-full rounded-xl border-2 border-indigo-100 px-4 py-3 font-bold" />
        </label>
        <label className="mt-4 block text-sm font-black text-indigo-950">Повторите PIN
          <input value={confirmPin} onChange={event => setConfirmPin(event.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" type="password" placeholder="4 цифры" className="mt-2 w-full rounded-xl border-2 border-indigo-100 px-4 py-3 font-bold" />
        </label>
        <p className="mt-4 rounded-2xl bg-indigo-50 p-3 text-xs font-bold text-indigo-700">PIN потребуется для перехода из игры в кабинет родителя на этом устройстве.</p>
        <button type="button" onClick={() => void submit()} disabled={isSaving} className="mt-6 w-full rounded-xl bg-indigo-600 py-3 font-black text-white disabled:opacity-60">{isSaving ? 'Создаю профиль...' : 'Создать профиль ребёнка'}</button>
      </section>
    </ScreenContainer>
  );
};
