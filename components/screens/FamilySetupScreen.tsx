import React, { useMemo, useState } from 'react';
import { ChildSetupResult } from '../../services/familyAccountService';
import { legalConsentService } from '../../services/legalConsentService';
import { LEGAL_DOCUMENTS, LEGAL_LINK_PROPS } from '../../services/legalDocuments';
import { profileApiService } from '../../services/profileApiService';
import { ScreenContainer } from '../layout/ScreenContainer';

interface FamilySetupScreenProps {
  onCreateChild: (childName: string, pin: string) => Promise<ChildSetupResult>;
  onComplete: (result: ChildSetupResult) => void;
  onBackHome: () => void;
}

const onlyDigits = (value: string): string => value.replace(/\D/g, '').slice(0, 4);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const steps = ['Ребёнок', 'Контакты и PIN', 'Питомец'];

export const FamilySetupScreen: React.FC<FamilySetupScreenProps> = ({ onCreateChild, onComplete, onBackHome }) => {
  const [childName, setChildName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [pin, setPin] = useState('');
  const [pinRepeat, setPinRepeat] = useState('');
  const [legalRepresentativeConsent, setLegalRepresentativeConsent] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinHint, setPinHint] = useState<string | null>(null);

  const normalizedName = childName.trim();
  const normalizedEmail = parentEmail.trim().toLowerCase();
  const normalizedPin = pin.trim();
  const normalizedPinRepeat = pinRepeat.trim();

  const validationError = useMemo(() => {
    if (!normalizedName) return 'Введите имя ребёнка.';
    if (normalizedName.length > 40) return 'Имя ребёнка должно быть не длиннее 40 символов.';
    if (normalizedEmail && !EMAIL_PATTERN.test(normalizedEmail)) return 'Введите корректный email родителя.';
    if (!/^\d{4}$/.test(normalizedPin)) return 'PIN должен состоять из 4 цифр.';
    if (normalizedPin !== normalizedPinRepeat) return 'PIN и повтор PIN не совпадают.';
    if (!legalRepresentativeConsent) return 'Подтвердите согласие законного представителя на обработку данных ребёнка.';
    return null;
  }, [legalRepresentativeConsent, normalizedEmail, normalizedName, normalizedPin, normalizedPinRepeat]);

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
    legalConsentService.setChildConsent(legalRepresentativeConsent);
    try {
      if (normalizedEmail) await profileApiService.updateParentContactEmail(normalizedEmail);
      const result = await onCreateChild(normalizedName, normalizedPin);
      onComplete(result);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Не удалось создать профиль ребёнка.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScreenContainer className="max-w-5xl pb-20 pt-6">
      <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-400">AnnWord Kids · настройка</p>
            <h1 className="mt-2 text-3xl font-black leading-tight text-indigo-950 sm:text-4xl">Создайте детский профиль</h1>
            <p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-slate-600">
              Добавим ребёнка, сохраним контакт взрослого и защитим кабинет родителя PIN-кодом. После этого ребёнок сможет назвать питомца и начать играть.
            </p>
          </div>
          <button type="button" onClick={onBackHome} className="rounded-2xl border-2 border-indigo-100 px-4 py-2 text-sm font-black text-indigo-700 transition hover:bg-indigo-50">На главную</button>
        </div>

        <ol className="mt-6 grid gap-2 text-xs font-black uppercase tracking-widest text-indigo-400 sm:grid-cols-3" aria-label="Шаги настройки">
          {steps.map((step, index) => <li key={step} className={`rounded-2xl px-4 py-3 ${index < 2 ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'}`}>{index + 1}. {step}</li>)}
        </ol>

        <form onSubmit={submit} className="mt-7 grid gap-5" noValidate>
          <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
            <section className="rounded-[1.75rem] border-2 border-indigo-50 bg-indigo-50/60 p-4 sm:p-5">
              <div className="text-xs font-black uppercase tracking-widest text-indigo-400">1. Ребёнок</div>
              <label className="mt-3 block text-sm font-black text-indigo-950" htmlFor="child-name">Имя ребёнка</label>
              <input id="child-name" value={childName} onChange={event => { setChildName(event.target.value); setError(null); }} maxLength={40} aria-describedby={error?.includes('имя') || error?.includes('Имя') ? 'family-setup-error' : undefined} placeholder="Например, Аня" className="mt-2 w-full rounded-2xl border-2 border-indigo-100 bg-white px-4 py-3 text-base font-bold text-indigo-950 outline-none transition focus:border-indigo-400" autoFocus />
              <p className="mt-3 text-xs font-bold leading-relaxed text-gray-500">Имя будет видно ребёнку, родителю и подключённому преподавателю.</p>
            </section>

            <section className="rounded-[1.75rem] border-2 border-purple-50 bg-purple-50/60 p-4 sm:p-5">
              <div className="text-xs font-black uppercase tracking-widest text-purple-400">2. Контакты взрослого</div>
              <label htmlFor="parent-email" className="mt-3 block text-sm font-black text-indigo-950">Email родителя <span className="font-bold text-gray-400">· необязательно</span></label>
              <input id="parent-email" value={parentEmail} onChange={event => { setParentEmail(event.target.value); setError(null); }} type="email" autoComplete="email" maxLength={254} aria-describedby="parent-email-help family-setup-error" placeholder="parent@example.ru" className="mt-2 w-full rounded-2xl border-2 border-purple-100 bg-white px-4 py-3 text-base font-bold text-indigo-950 outline-none transition focus:border-purple-400" />
              <p id="parent-email-help" className="mt-2 text-xs font-bold leading-relaxed text-gray-500">Это отдельный контактный адрес: он не меняет email для входа. Позже его можно изменить в кабинете родителя и использовать для отчётов.</p>

              <div className="mt-5 border-t-2 border-purple-100 pt-4">
                <p className="text-sm font-bold leading-relaxed text-gray-600">PIN нужен, чтобы ребёнок случайно не попал в кабинет родителя на этом устройстве.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label htmlFor="parent-pin" className="text-sm font-black text-indigo-950">PIN родителя</label>
                    <input id="parent-pin" value={pin} onChange={event => handlePinChange(event.target.value, setPin)} type="password" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" autoComplete="new-password" aria-describedby="pin-help family-setup-error pin-format-hint" placeholder="4 цифры" className="rounded-2xl border-2 border-indigo-100 bg-white px-4 py-3 text-base font-bold text-indigo-950 outline-none transition focus:border-indigo-400" />
                  </div>
                  <div className="grid gap-2">
                    <label htmlFor="parent-pin-repeat" className="text-sm font-black text-indigo-950">Повторите PIN</label>
                    <input id="parent-pin-repeat" value={pinRepeat} onChange={event => handlePinChange(event.target.value, setPinRepeat)} type="password" inputMode="numeric" maxLength={4} pattern="[0-9]{4}" autoComplete="new-password" aria-describedby="pin-help family-setup-error pin-format-hint" placeholder="4 цифры" className="rounded-2xl border-2 border-indigo-100 bg-white px-4 py-3 text-base font-bold text-indigo-950 outline-none transition focus:border-indigo-400" />
                  </div>
                </div>
                <div id="pin-help" className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs font-bold leading-5 text-purple-900">На новом устройстве потребуется обычный вход в аккаунт. PIN не заменяет пароль.</div>
              </div>
            </section>
          </div>

          <div className="flex items-start gap-3 rounded-2xl border-2 border-indigo-100 bg-white px-4 py-4 text-sm font-bold leading-6 text-slate-700">
            <input id="child-data-consent" type="checkbox" checked={legalRepresentativeConsent} onChange={event => { setLegalRepresentativeConsent(event.target.checked); setError(null); }} className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
            <label htmlFor="child-data-consent" className="cursor-pointer">Я подтверждаю, что являюсь родителем или иным законным представителем ребёнка, и принимаю <a href={LEGAL_DOCUMENTS.childDataConsent} {...LEGAL_LINK_PROPS} className="font-black text-indigo-700 underline decoration-indigo-200 underline-offset-2 transition hover:text-indigo-900 hover:decoration-indigo-500">Согласие на обработку персональных данных ребёнка</a>.</label>
          </div>

          {pinHint && <div id="pin-format-hint" role="status" aria-live="polite" className="rounded-2xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">{pinHint}</div>}
          {error && <div id="family-setup-error" role="alert" aria-live="assertive" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{error}</div>}

          <button type="submit" disabled={isSaving || !legalRepresentativeConsent} className="rounded-2xl bg-indigo-600 px-5 py-4 text-base font-black text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">
            {isSaving ? 'Сохраняем настройки...' : 'Продолжить к выбору питомца'}
          </button>
        </form>
      </section>
    </ScreenContainer>
  );
};

export default FamilySetupScreen;
