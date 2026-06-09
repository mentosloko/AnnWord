import React, { useMemo, useState } from 'react';
import { ChildSetupResult } from '../../services/familyAccountService';

interface FamilySetupScreenProps {
  onCreateChild: (childName: string, pin: string) => Promise<ChildSetupResult>;
  onComplete: (result: ChildSetupResult) => void;
  onBackHome: () => void;
}

const onlyDigits = (value: string): string => value.replace(/\D/g, '').slice(0, 4);

export const FamilySetupScreen: React.FC<FamilySetupScreenProps> = ({
  onCreateChild,
  onComplete,
  onBackHome
}) => {
  const [childName, setChildName] = useState('');
  const [pin, setPin] = useState('');
  const [pinRepeat, setPinRepeat] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const result = await onCreateChild(normalizedName, normalizedPin);
      onComplete(result);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Не удалось создать профиль ребёнка.';
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-4xl items-center justify-center px-4 py-8">
      <section className="w-full rounded-[2rem] border border-indigo-100 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-500">
              Семейный профиль
            </p>
            <h1 className="mt-2 text-3xl font-black text-indigo-950">
              Создайте профиль ребёнка
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-slate-600">
              В базовом сценарии один Premium открывает доступ для одного ребёнка.
              Второй ребёнок добавляется позднее через кабинет родителя после покупки
              второго Premium.
            </p>
          </div>

          <button
            type="button"
            onClick={onBackHome}
            className="rounded-2xl border border-indigo-100 px-4 py-2 text-sm font-black text-indigo-700 transition hover:bg-indigo-50"
          >
            На главную
          </button>
        </div>

        <form onSubmit={submit} className="mt-8 grid gap-5">
          <label className="grid gap-2">
            <span className="text-sm font-black text-indigo-950">
              Имя ребёнка
            </span>
            <input
              value={childName}
              onChange={event => setChildName(event.target.value)}
              maxLength={40}
              placeholder="Например, Аня"
              className="rounded-2xl border border-indigo-100 bg-indigo-50/40 px-4 py-3 text-base font-bold text-indigo-950 outline-none transition focus:border-indigo-400 focus:bg-white"
              autoFocus
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-black text-indigo-950">
                PIN родителя
              </span>
              <input
                value={pin}
                onChange={event => setPin(onlyDigits(event.target.value))}
                inputMode="numeric"
                autoComplete="new-password"
                placeholder="4 цифры"
                className="rounded-2xl border border-indigo-100 bg-indigo-50/40 px-4 py-3 text-base font-bold text-indigo-950 outline-none transition focus:border-indigo-400 focus:bg-white"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black text-indigo-950">
                Повторите PIN
              </span>
              <input
                value={pinRepeat}
                onChange={event => setPinRepeat(onlyDigits(event.target.value))}
                inputMode="numeric"
                autoComplete="new-password"
                placeholder="4 цифры"
                className="rounded-2xl border border-indigo-100 bg-indigo-50/40 px-4 py-3 text-base font-bold text-indigo-950 outline-none transition focus:border-indigo-400 focus:bg-white"
              />
            </label>
          </div>

          <div className="rounded-2xl bg-sky-50 px-4 py-3 text-sm font-semibold leading-6 text-sky-900">
            PIN нужен только для входа в кабинет родителя на уже зарегистрированном
            устройстве. На новом устройстве потребуется обычный вход в аккаунт.
          </div>

          {error && (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="rounded-2xl bg-indigo-600 px-5 py-3 text-base font-black text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? 'Создаём профиль...' : 'Создать профиль ребёнка'}
          </button>
        </form>
      </section>
    </main>
  );
};

export default FamilySetupScreen;
