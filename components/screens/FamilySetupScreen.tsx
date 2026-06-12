import React, { useMemo, useState } from 'react';
import { ChildSetupResult } from '../../services/familyAccountService';

interface FamilySetupScreenProps {
  onCreateChild: (childName: string, pin: string) => Promise<ChildSetupResult>;
  onComplete: (result: ChildSetupResult) => void;
  onBackHome: () => void;
}

const onlyDigits = (value: string): string => value.replace(/\D/g, '').slice(0, 4);

export const FamilySetupScreen: React.FC<FamilySetupScreenProps> = ({ onCreateChild, onComplete, onBackHome }) => {
  const [childName, setChildName] = useState('');
  const [pin, setPin] = useState('');
  const [pinRepeat, setPinRepeat] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinHint, setPinHint] = useState<string | null>(null);

  const normalizedName = childName.trim();
  const normalizedPin = pin.trim();
  const normalizedPinRepeat = pinRepeat.trim();

  const validationError = useMemo(() => {
    if (!normalizedName) return 'Введите имя ребёнка.';
    if (normalizedName.length > 40) return 'Имя ребёнка должно быть не длиннее 40 символов.';
    if (!/^\d{4}$/.test(normalizedPin)) return 'PIN должен состоять из 4 цифр.';
    if (normalizedPin !== normalizedPinRepeat) return 'PIN и повтор PIN не совпадают.';
    return null;
  }, [normalizedName, normalizedPin, normalizedPinRepeat]);

  const handlePinChange = (value: string, setter: (value: string) => void) => {
    const next = onlyDigits(value);
    setter(next);
    setError(null);
    setPinHint(value && next !== value ? 'PIN состоит только из цифр.' : null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (validationError) { setError(validationError); return; }
    setIsSaving(true);
    setError(null);
    try {
      const result = await onCreateChild(normalizedName, normalizedPin);
      onComplete(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось создать профиль ребёнка.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-4xl items-center justify-center px-4 py-8">
      <section className="w-full rounded-[2rem] border border-indigo-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-500">Семейный профиль</p>
            <h1 className="mt-2 text-3xl font-black text-indigo-950">Создайте профиль ребёнка</h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              Сначала добавим ребёнка и защитим кабинет родителя PIN-кодом на этом устройстве. Оплату и дополнительные возможности можно настроить позже.
            </p>
          </div>
          <button type="button" onClick={onBackHome} className="rounded-2xl border border-indigo-100 px-4 py-2 text-sm font-black text-indigo-700 transition hover:bg-indigo-50">На главную</button>
        </div>

        <ol className="mt-6 grid gap-2 text-xs font-black uppercase tracking-widest text-indigo-400 sm:grid-cols-3" aria-label="Шаги настройки">
          <li className="rounded-2xl bg-indigo-50 px-4 py-3 text-indigo-700">1. Ребёнок</li>
          <li className="rounded-2xl bg-indigo-50 px-4 py-3 text-indigo-700">2. PIN родителя</li>
          <li className="rounded-2xl bg-indigo-50 px-4 py-3 text-indigo-700">3. Питомец</li>
        </ol>

        <form onSubmit={submit} className="mt-8 grid gap-5" noValidate>
          <label className="grid gap-2" htmlFor="child-name">
            <span className="text-sm font-black text-indigo-950">Имя ребёнка</span>
          </label>
          <input id="child-name" value={childName} onChange={event => { setChildName(event.target.value); setError(null); }} maxLength={40} aria-describedby={error?.includes('имя') || error?.includes('Имя') ? 'family-setup-error' : undefined} placeholder="Например, Аня" className="rounded-2xl border border-indigo-100 bg-indigo-50/40 px-4 py-3 text-base font-bold text-indigo-950 outline-none transition focus:border-indigo-400 focus:bg-white" autoFocus />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="parent-pin" className="text-sm font-black text-indigo-950">PIN родителя</label>
              <input id="parent-pin" value={pin} onChange={event => handlePinChange(event.target.value, setPin)} type="password" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" autoComplete="new-password" aria-describedby="pin-help family-setup-error pin-format-hint" placeholder="4 цифры" className="rounded-2xl border border-indigo-100 bg-indigo-50/40 px-4 py-3 text-base font-bold text-indigo-950 outline-none transition focus:border-indigo-400 focus:bg-white" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="parent-pin-repeat" className="text-sm font-black text-indigo-950">Повторите PIN</label>
              <input id="parent-pin-repeat" value={pinRepeat} onChange={event => handlePinChange(event.target.value, setPinRepeat)} type="password" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" autoComplete="new-password" aria-describedby="pin-help family-setup-error pin-format-hint" placeholder="4 цифры" className="rounded-2xl border border-indigo-100 bg-indigo-50/40 px-4 py-3 text-base font-bold text-indigo-950 outline-none transition focus:border-indigo-400 focus:bg-white" />
            </div>
          </div>

          <div id="pin-help" className="rounded-2xl bg-sky-50 px-4 py-3 text-sm font-semibold leading-6 text-sky-900">
            PIN нужен только для входа в кабинет родителя на уже зарегистрированном устройстве. На новом устройстве потребуется обычный вход в аккаунт.
          </div>
          {pinHint && <div id="pin-format-hint" role="status" aria-live="polite" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{pinHint}</div>}
          {error && <div id="family-setup-error" role="alert" aria-live="assertive" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

          <button type="submit" disabled={isSaving} className="rounded-2xl bg-indigo-600 px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
            {isSaving ? 'Создаём профиль...' : 'Создать профиль ребёнка'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default FamilySetupScreen;
