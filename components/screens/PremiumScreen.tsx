import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { getKidsDictionaryCatalog } from '../../services/kidsDictionaryCatalog';
import { LEGAL_DOCUMENTS, LEGAL_LINK_PROPS } from '../../services/legalDocuments';
import { isKidsMode } from '../../services/modeFlags';
import { formatPremiumExpiresAt } from '../../services/premiumAccess';
import { getPremiumDictionaryCatalog, hasPremiumDictionaryAccess } from '../../services/premiumDictionaryCatalog';
import { getProdamusPlansForMode, prodamusPaymentService, ProdamusPlanCode } from '../../services/prodamusPaymentService';
import { useProfileFreshness } from '../../hooks/useProfileFreshness';
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
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const startPayment = async (planCode: ProdamusPlanCode) => {
    if (accessChecking) return;
    setLoadingPlan(planCode);
    setPaymentError(null);
    try {
      const payment = await prodamusPaymentService.createPayment(planCode);
      window.location.href = payment.checkoutUrl;
    } catch (error: unknown) {
      setPaymentError(error instanceof Error ? error.message : 'Не удалось перейти к оплате.');
      setLoadingPlan(null);
    }
  };

  return <ScreenContainer className="max-w-6xl pb-20 pt-6">
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
              {plans.map(plan => <button key={plan.code} type="button" disabled={loadingPlan !== null} onClick={() => void startPayment(plan.code)} className="rounded-2xl border-2 border-amber-100 bg-amber-500 px-5 py-4 text-left font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-amber-600 disabled:cursor-wait disabled:opacity-70"><span className="block text-lg">{plan.title}</span><span className="mt-1 block text-sm text-white/85">{plan.amountRub.toLocaleString('ru-RU')} ₽</span><span className="mt-2 block text-xs text-white/75">{loadingPlan === plan.code ? 'Открываю оплату…' : 'Перейти к оплате Prodamus'}</span></button>)}
            </div> : DEV_TRIAL_ENABLED && onTestUnlockPremium ? <button type="button" onClick={onTestUnlockPremium} className="rounded-2xl bg-amber-500 px-6 py-4 font-black text-white shadow-sm transition hover:bg-amber-600">Открыть Premium на 7 дней</button> : <button type="button" disabled className="rounded-2xl bg-gray-100 px-6 py-4 font-black text-gray-400">Оплата скоро будет подключена</button>}
            {!hasPremium && !accessChecking && PAYMENTS_ENABLED && <p className="mt-3 max-w-2xl text-xs font-bold leading-relaxed text-gray-500">Переходя к оплате, вы подтверждаете, что ознакомились и согласны с условиями <a href={LEGAL_DOCUMENTS.publicOffer} {...LEGAL_LINK_PROPS} className="font-black text-indigo-700 underline decoration-indigo-200 underline-offset-2 transition hover:text-indigo-900 hover:decoration-indigo-500">Публичной оферты</a>.</p>}
            <button type="button" onClick={onBack} className="mt-3 rounded-2xl border-2 border-indigo-100 bg-white px-6 py-4 font-black text-indigo-700 transition hover:bg-indigo-50">Вернуться</button>
          </div>
          {paymentError && <p role="alert" className="mt-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">{paymentError}</p>}
          {hasPremium ? <p className="mt-3 text-xs font-bold leading-relaxed text-gray-400">Premium активен до: {formatPremiumExpiresAt(userProfile.premiumExpiresAt)}.</p> : accessChecking ? <p className="mt-3 text-xs font-bold leading-relaxed text-indigo-500">Обновляем сведения об аккаунте…</p> : <p className="mt-3 text-xs font-bold leading-relaxed text-gray-400">Оплата проходит через Prodamus. Premium включается только после серверного подтверждения оплаты.</p>}
        </div>
        <div className="rounded-[2rem] border-2 border-amber-100 bg-amber-50/60 p-4">
          <div className="grid grid-cols-2 gap-3">
            {dictionaries.map(item => <div key={item.id} className="rounded-2xl border-2 border-white bg-white p-3 shadow-sm"><div className="flex items-center justify-between gap-2"><span className="text-2xl" aria-hidden="true">{item.icon}</span><span className="text-sm">{hasPremium ? '✅' : accessChecking ? '⏳' : '🔒'}</span></div><div className="mt-2 truncate text-sm font-black text-indigo-950">{item.shortTitle}</div><div className="text-xs font-black text-amber-700">Тематический словарь · A1–C2</div></div>)}
          </div>
        </div>
      </div>
    </section>
  </ScreenContainer>;
};
