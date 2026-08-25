import React, { useMemo, useState } from 'react';
import { ChildSetupResult } from '../../services/familyAccountService';
import { legalConsentService } from '../../services/legalConsentService';
import { LEGAL_DOCUMENTS, LEGAL_LINK_PROPS } from '../../services/legalDocuments';
import { ScreenContainer } from '../layout/ScreenContainer';
import { StableStatusSlot } from '../ui/StatusNotice';

interface FamilySetupScreenProps {
  onCreateChild: (childName: string, pin: string) => Promise<ChildSetupResult>;
  onComplete: (result: ChildSetupResult) => void;
  onBackHome: () => void;
}

const onlyDigits = (value: string): string => value.replace(/\D/g, '').slice(0, 4);
const steps = ['Ребёнок', 'Родительский блок', 'Питомец'];

export const FamilySetupScreen: React.FC<FamilySetupScreenProps> = ({ onCreateChild, onComplete, onBackHome }) => {
  const [childName, setChildName] = useState('');
  const [pin, setPin] = useState('');
  const [pinRepeat, setPinRepeat] = useState('');
  const [legalRepresentativeConsent, setLegalRepresentativeConsent] = useState(false);
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
    if (!legalRepresentativeConsent) return 'Подтвердите согласие законного представителя на обработку данных ребёнка.';
    return null;
  }, [legalRepresentativeConsent, normalizedName, normalizedPin, normalizedPinRepeat]);

  const handlePinChange = (value: string, setter: (value: string) => void) => {
    const next = onlyDigits(value);
    setter(next);
    setError(null);
    setPinHint(value && next !== value ? 'PIN состоит только из цифр.' : null);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (validationError) { setError(validationError); return; }
    setIsSaving(true); setError(null);
    legalConsentService.setChildConsent(legalRepresentativeConsent);
    try { onComplete(await onCreateChild(normalizedName, normalizedPin)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Не удалось создать профиль ребёнка.'); }
    finally { setIsSaving(false); }
  };

  return <ScreenContainer className="max-w-5xl pb-20 pt-6">
    <section className="rounded-[2rem] border-2 border-indigo-50 bg-white p-5 shadow-sm sm:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.28em] text-indigo-400">AnnWord Kids · настройка</p><h1 className="mt-2 text-3xl font-black leading-tight text-indigo-950 sm:text-4xl">Настройте детский профиль</h1><p className="mt-3 max-w-2xl text-sm font-bold leading-6 text-slate-600">Добавьте ребёнка и защитите родительский блок PIN-кодом. Email для входа уже сохранён в аккаунте; адрес для отчётов при необходимости можно изменить позже в кабинете родителя.</p></div><button type="button" onClick={onBackHome} className="rounded-2xl border-2 border-indigo-100 px-4 py-2 text-sm font-black text-indigo-700">На главную</button></div>
      <ol className="mt-6 grid gap-2 text-xs font-black uppercase tracking-widest text-indigo-400 sm:grid-cols-3" aria-label="Шаги настройки">{steps.map((step, index) => <li key={step} className={`rounded-2xl px-4 py-3 ${index < 2 ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'}`}>{index + 1}. {step}</li>)}</ol>
      <form onSubmit={submit} className="mt-7 grid gap-5" noValidate>
        <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
          <section className="rounded-[1.75rem] border-2 border-indigo-50 bg-indigo-50/60 p-4 sm:p-5"><div className="text-xs font-black uppercase tracking-widest text-indigo-400">1. Ребёнок</div><label className="mt-3 block text-sm font-black text-indigo-950" htmlFor="child-name">Имя ребёнка</label><input id="child-name" required value={childName} onChange={event => { setChildName(event.target.value); setError(null); }} maxLength={40} placeholder="Например, Аня" className="mt-2 w-full rounded-2xl border-2 border-indigo-100 bg-white px-4 py-3 text-base font-bold text-indigo-950 outline-none focus:border-indigo-400" autoFocus /><p className="mt-3 text-xs font-bold leading-relaxed text-gray-500">Имя будет видно ребёнку, родителю и подключённому преподавателю.</p></section>
          <section className="rounded-[1.75rem] border-2 border-purple-50 bg-purple-50/60 p-4 sm:p-5"><div className="text-xs font-black uppercase tracking-widest text-purple-400">2. Родительский блок</div><div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><div className="text-xs font-black uppercase tracking-widest text-amber-600">Первый месяц Kids Premium бесплатно</div><h2 className="mt-1 text-lg font-black text-indigo-950">Словари по классам и свои слова — сразу после настройки</h2><p className="mt-2 text-xs font-bold leading-5 text-slate-600">Пробный период уже привязан к аккаунту и закончится автоматически через месяц. После него бесплатные игры и общий детский словарь останутся доступны.</p></div><p id="parent-pin-setup-help" className="mt-4 text-sm font-bold leading-relaxed text-gray-600">PIN нужен, чтобы ребёнок случайно не попал в настройки взрослого. Нужны ровно 4 цифры.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-black text-indigo-950">PIN родителя<input required value={pin} onChange={event => handlePinChange(event.target.value, setPin)} type="password" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} autoComplete="new-password" placeholder="4 цифры" aria-describedby="parent-pin-setup-help" className="rounded-2xl border-2 border-indigo-100 bg-white px-4 py-3 text-base font-bold outline-none focus:border-indigo-400" /></label><label className="grid gap-2 text-sm font-black text-indigo-950">Повторите PIN<input required value={pinRepeat} onChange={event => handlePinChange(event.target.value, setPinRepeat)} type="password" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} autoComplete="new-password" placeholder="4 цифры" aria-describedby="parent-pin-setup-help" className="rounded-2xl border-2 border-indigo-100 bg-white px-4 py-3 text-base font-bold outline-none focus:border-indigo-400" /></label></div><div className="mt-4 rounded-2xl bg-white px-4 py-3 text-xs font-bold leading-5 text-purple-900">На новом устройстве потребуется обычный вход в аккаунт. PIN не заменяет пароль.</div></section>
        </div>
        <div className="flex items-start gap-3 rounded-2xl border-2 border-indigo-100 bg-white px-4 py-4 text-sm font-bold leading-6 text-slate-700"><input id="child-data-consent" required type="checkbox" checked={legalRepresentativeConsent} onChange={event => { setLegalRepresentativeConsent(event.target.checked); setError(null); }} className="mt-0.5 h-5 w-5 shrink-0 rounded" /><label htmlFor="child-data-consent">Я подтверждаю, что являюсь родителем или иным законным представителем ребёнка, и принимаю <a href={LEGAL_DOCUMENTS.childDataConsent} {...LEGAL_LINK_PROPS} className="font-black text-indigo-700 underline">Согласие на обработку персональных данных ребёнка</a>.</label></div>
        <StableStatusSlot message={error || pinHint} tone={error ? 'error' : 'warning'} role={error ? 'alert' : 'status'} />
        <button type="submit" disabled={isSaving || Boolean(validationError)} className="rounded-2xl bg-indigo-600 px-5 py-4 text-base font-black text-white disabled:opacity-60">{isSaving ? 'Сохраняю…' : 'Продолжить к питомцу'}</button>
      </form>
    </section>
  </ScreenContainer>;
};