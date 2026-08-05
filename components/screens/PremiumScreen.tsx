import React, { useEffect, useRef, useState } from 'react';
import { UserProfile } from '../../types';
import { getKidsDictionaryCatalog } from '../../services/kidsDictionaryCatalog';
import { LEGAL_DOCUMENTS, LEGAL_LINK_PROPS } from '../../services/legalDocuments';
import { isKidsMode } from '../../services/modeFlags';
import { formatPremiumAccessPeriod } from '../../services/premiumAccess';
import { getPremiumDictionaryCatalog, hasPremiumDictionaryAccess } from '../../services/premiumDictionaryCatalog';
import { getProdamusPlansForMode, prodamusPaymentService, ProdamusPlanCode } from '../../services/prodamusPaymentService';
import { familyAccountService } from '../../services/familyAccountService';
import { analyticsService } from '../../services/analyticsService';
import { useProfileFreshness } from '../../hooks/useProfileFreshness';
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock';
import { ScreenContainer } from '../layout/ScreenContainer';

 type PremiumScreenProps = {
  userProfile: UserProfile;
  onBack: () => void;
  onOpenDictionarySetup: () => void;
  onTestUnlockPremium?: () => void;
};

const PAYMENTS_ENABLED = import.meta.env.VITE_ENABLE_PRODAMUS_PAYMENTS === 'true';
const DEV_TRIAL_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_TEST_PREMIUM_UNLOCK === 'true';

export const PremiumScreen: React.FC<PremiumScreenProps> = ({ userProfile, onBack, onOpenDictionarySetup, onTestUnlockPremium }) => {
  const profileFreshness = useProfileFreshness();
  const kidsMode = isKidsMode(userProfile, true);
  const hasPremium = hasPremiumDictionaryAccess(userProfile);
  const accessChecking = !hasPremium && profileFreshness !== 'fresh';
  const dictionaries = kidsMode ? getKidsDictionaryCatalog() : getPremiumDictionaryCatalog();
  const premiumTitle = kidsMode ? 'Kids Premium' : 'AnnWord Premium';
  const headline = kidsMode ? 'Игры по словам, которые ребёнку действительно нужно повторить' : 'Учите не случайные слова, а нужные именно вам';
  const body = kidsMode
    ? 'В бесплатном режиме ребёнок играет по базовому набору. Premium открывает детские темы и возможность добавить слова из школы, курса или учебника — чтобы тренировка была ближе к реальным занятиям.'
    : 'Откройте тематические словари и добавляйте слова из работы, экзамена, курса или своей темы. Доступны наборы Business, Travel, Medicine, IELTS, IT, Finance, Legal, Science, Everyday+ и Food.';
  const plans = getProdamusPlansForMode(kidsMode);
  const [loadingPlan, setLoadingPlan] = useState<ProdamusPlanCode | null>(null);
  const [pendingPlan, setPendingPlan] = useState<ProdamusPlanCode | null>(null);
  const [parentPin, setParentPin] = useState('');
  const [parentPinError, setParentPinError] = useState<string | null>(null);
  const [verifyingParent, setVerifyingParent] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const pinInputRef = useRef<HTMLInputElement>(null);
  const premiumOpenTrackedRef = useRef(false);
  const productMode = kidsMode ? 'kids' : 'practice';
  const planPayload = (planCode: ProdamusPlanCode) => {
    const plan = plans.find(item => item.code === planCode);
    return {
      mode: productMode,
      role: userProfile.role || 'user',
      planCode,
      amountRub: plan?.amountRub || null,
      periodDays: plan?.periodDays || null,
    };
  };

  useEffect(() => {
    if (premiumOpenTrackedRef.current) return;
    premiumOpenTrackedRef.current = true;
    analyticsService.trackEvent({
      eventType: 'premium',
      eventName: 'premium_opened',
      route: 'premium',
      payload: { mode: productMode, role: userProfile.role || 'user', hasPremium, paymentsEnabled: PAYMENTS_ENABLED },
    });
  }, [hasPremium, productMode, userProfile.role]);

  useBodyScrollLock(Boolean(pendingPlan));
  useEffect(() => {
    if (!pendingPlan) return;
    const timer = window.setTimeout(() => pinInputRef.current?.focus(), 0);
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !verifyingParent) setPendingPlan(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [pendingPlan, verifyingParent]);

  const startPayment = async (planCode: ProdamusPlanCode) => {
    if (accessChecking) return;
    setLoadingPlan(planCode);
    setPaymentError(null);
    const payload = planPayload(planCode);
    try {
      const payment = await prodamusPaymentService.createPayment(planCode);
      analyticsService.trackEvent({ eventType: 'payment', eventName: 'checkout_created', route: 'premium', payload: { ...payload, orderId: payment.orderId } });
      let checkoutHost: string | null = null;
      try { checkoutHost = new URL(payment.checkoutUrl).host; } catch { checkoutHost = null; }
      analyticsService.trackEvent({ eventType: 'payment', eventName: 'checkout_redirected', route: 'premium', payload: { ...payload, orderId: payment.orderId, checkoutHost } });
      void analyticsService.flush();
      window.location.assign(payment.checkoutUrl);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Не удалось перейти к оплате.';
      analyticsService.trackEvent({ eventType: 'payment', eventName: 'payment_error', route: 'premium', payload: { ...payload, stage: 'create_checkout', message } });
      setPaymentError(message);
      setLoadingPlan(null);
    }
  };

  const choosePlan = (planCode: ProdamusPlanCode) => {
    setPaymentError(null);
    analyticsService.trackEvent({ eventType: 'premium', eventName: 'premium_plan_selected', route: 'premium', payload: planPayload(planCode) });
    if (!kidsMode) {
      void startPayment(planCode);
      return;
    }
    setParentPin('');
    setParentPinError(null);
    setPendingPlan(planCode);
  };

  const confirmParentAndPay = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pendingPlan || verifyingParent) return;
    if (!/^\d{4}$/.test(parentPin)) {
      setParentPinError('Введите PIN родителя из четырёх цифр.');
      return;
    }
    setVerifyingParent(true);
    setParentPinError(null);
    try {
      const verified = await familyAccountService.verifyParentPin(parentPin);
      if (!verified) {
        setParentPinError('Неверный PIN родителя. Проверьте четыре цифры.');
        return;
      }
      const plan = pendingPlan;
      setPendingPlan(null);
      setParentPin('');
      await startPayment(plan);
    } catch (error) {
      setParentPinError(error instanceof Error ? error.message : 'Не удалось проверить PIN родителя.');
    } finally {
      setVerifyingParent(false);
    }
  };

  return <>
    <ScreenContainer className="max-w-6xl pb-20 pt-6">
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 rounded-2xl border-2 border-indigo-100 bg-white px-4 py-2 font-black text-indigo-700 transition hover:bg-indigo-50">← Назад</button>
      <section className="overflow-hidden rounded-[2.25rem] border-2 border-amber-100 bg-white shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-amber-600"><span aria-hidden="true">✦</span>{premiumTitle}</div>
            <h1 className="mt-5 text-4xl font-black leading-tight text-indigo-950 sm:text-5xl">{headline}</h1>
            <p className="mt-4 max-w-2xl text-base font-bold leading-relaxed text-gray-600">{body}</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-3xl border-2 border-indigo-50 bg-indigo-50/60 p-4"><div className="text-2xl font-black text-indigo-700">Темы под цель</div><div className="mt-2 text-xs font-black uppercase tracking-widest text-indigo-400">готовые наборы</div></div>
              <div className="rounded-3xl border-2 border-purple-50 bg-purple-50/60 p-4"><div className="text-2xl font-black text-purple-700">Свой список</div><div className="mt-2 text-xs font-black uppercase tracking-widest text-purple-400">ваши слова</div></div>
              <div className="rounded-3xl border-2 border-green-50 bg-green-50/60 p-4"><div className="text-3xl font-black text-green-700">A1–C2</div><div className="text-xs font-black uppercase tracking-widest text-green-400">уровни</div></div>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              {(kidsMode ? ['Детские темы', 'Слова из школы или курса', 'Все игры по выбранным словам'] : ['Темы под цель', 'Слова из вашего списка', 'Все игры по выбранным словам']).map(item => <div key={item} className="rounded-2xl border-2 border-amber-100 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800">{item}</div>)}
            </div>
            <div className="mt-6">
              {hasPremium ? <button type="button" onClick={onOpenDictionarySetup} className="rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white shadow-sm transition hover:bg-indigo-700">{kidsMode ? 'Выбрать слова для ребёнка' : 'Выбрать слова для тренировки'}</button> : accessChecking ? <div role="status" aria-live="polite" className="max-w-xl rounded-2xl border-2 border-indigo-100 bg-indigo-50 px-5 py-4"><div className="font-black text-indigo-800">Проверяем ваш Premium-доступ…</div><p className="mt-1 text-sm font-bold text-indigo-600">Кнопки оплаты появятся только после подтверждения текущего тарифа сервером.</p></div> : PAYMENTS_ENABLED ? <div className="grid gap-3 sm:grid-cols-2">
                {plans.map(plan => <button key={plan.code} type="button" disabled={loadingPlan !== null} onClick={() => choosePlan(plan.code)} className="rounded-2xl border-2 border-amber-100 bg-amber-500 px-5 py-4 text-left font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-600 disabled:cursor-wait disabled:opacity-70"><span className="block text-lg">{plan.title}</span><span className="mt-1 block text-sm text-white/85">{plan.amountRub.toLocaleString('ru-RU')} ₽</span><span className="mt-2 block text-xs text-white/75">{loadingPlan === plan.code ? 'Открываю оплату…' : kidsMode ? 'Продолжить с PIN родителя' : 'Перейти к оплате Prodamus'}</span></button>)}
              </div> : DEV_TRIAL_ENABLED && onTestUnlockPremium ? <button type="button" onClick={onTestUnlockPremium} className="rounded-2xl bg-amber-500 px-6 py-4 font-black text-white shadow-sm transition hover:bg-amber-600">Открыть Premium на 7 дней</button> : <button type="button" disabled className="rounded-2xl bg-gray-100 px-6 py-4 font-black text-gray-400">Оплата скоро будет подключена</button>}
              {!hasPremium && !accessChecking && PAYMENTS_ENABLED && <p className="mt-3 max-w-2xl text-xs font-bold leading-relaxed text-gray-500">{kidsMode && 'Перед переходом к оплате понадобится PIN родителя. '}Переходя к оплате, вы подтверждаете, что ознакомились и согласны с условиями <a href={LEGAL_DOCUMENTS.publicOffer} {...LEGAL_LINK_PROPS} className="font-black text-indigo-700 underline decoration-indigo-200 underline-offset-2 transition hover:text-indigo-900 hover:decoration-indigo-500">Публичной оферты</a>.</p>}
              <button type="button" onClick={onBack} className="mt-3 rounded-2xl border-2 border-indigo-100 bg-white px-6 py-4 font-black text-indigo-700 transition hover:bg-indigo-50">Вернуться</button>
            </div>
            {paymentError && <p role="alert" className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{paymentError}</p>}
            {hasPremium ? <p className="mt-3 text-xs font-bold leading-relaxed text-gray-400">Premium активен {formatPremiumAccessPeriod(userProfile.premiumExpiresAt)}.</p> : accessChecking ? <p className="mt-3 text-xs font-bold leading-relaxed text-indigo-500">Обновляем сведения об аккаунте…</p> : <p className="mt-3 text-xs font-bold leading-relaxed text-gray-400">Оплата проходит через Prodamus. Premium включается только после серверного подтверждения оплаты.</p>}
          </div>
          <div className="rounded-[2rem] border-2 border-amber-100 bg-amber-50/60 p-4">
            <div className="grid grid-cols-2 gap-3">
              {dictionaries.map(item => <div key={item.id} className="rounded-2xl border-2 border-white bg-white p-3 shadow-sm"><div className="flex items-center justify-between gap-2"><span className="text-2xl" aria-hidden="true">{item.icon}</span><span className="text-sm">{hasPremium ? '✅' : accessChecking ? '⏳' : '🔒'}</span></div><div className="mt-2 truncate text-sm font-black text-indigo-950">{item.shortTitle}</div><div className="text-xs font-black text-amber-700">Тематический словарь · A1–C2</div></div>)}
            </div>
          </div>
        </div>
      </section>
    </ScreenContainer>
    {pendingPlan && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-indigo-950/60 p-3 backdrop-blur-sm" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="parent-payment-title" className="w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-widest text-amber-600">Подтверждение взрослого</div><h2 id="parent-payment-title" className="mt-1 text-2xl font-black text-indigo-950">Введите PIN родителя</h2></div><button type="button" disabled={verifyingParent} onClick={() => setPendingPlan(null)} aria-label="Закрыть" className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-xl font-black text-indigo-500 disabled:opacity-50">×</button></div>
        <p className="mt-3 text-sm font-bold leading-relaxed text-slate-600">Описание Premium можно смотреть вместе с ребёнком, но переход к оплате должен подтвердить взрослый.</p>
        <form onSubmit={confirmParentAndPay} className="mt-5">
          <label htmlFor="premium-parent-pin" className="block text-sm font-black text-indigo-950">PIN родителя из 4 цифр</label>
          <input ref={pinInputRef} id="premium-parent-pin" value={parentPin} onChange={event => { setParentPin(event.target.value.replace(/\D/g, '').slice(0, 4)); setParentPinError(null); }} type="password" inputMode="numeric" autoComplete="off" maxLength={4} placeholder="••••" aria-invalid={Boolean(parentPinError) || undefined} className="mt-2 w-full rounded-2xl border-2 border-indigo-100 p-4 text-center text-2xl font-black tracking-[0.5em] outline-none focus:border-indigo-500" />
          {parentPinError && <p role="alert" className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{parentPinError}</p>}
          <button type="submit" disabled={verifyingParent || parentPin.length !== 4} className="mt-4 w-full rounded-2xl bg-indigo-600 px-5 py-4 font-black text-white disabled:cursor-not-allowed disabled:opacity-50">{verifyingParent ? 'Проверяю PIN…' : 'Подтвердить и перейти к оплате'}</button>
          <button type="button" disabled={verifyingParent} onClick={() => setPendingPlan(null)} className="mt-2 w-full rounded-2xl border-2 border-indigo-100 bg-white px-5 py-3 font-black text-indigo-700 disabled:opacity-50">Отмена</button>
        </form>
      </div>
    </div>}
  </>;
};
