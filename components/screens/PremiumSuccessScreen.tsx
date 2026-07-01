import React, { useEffect, useMemo, useState } from 'react';
import { UserProfile } from '../../types';
import { isKidsMode } from '../../services/modeFlags';
import { formatPremiumExpiresAt } from '../../services/premiumAccess';
import { profileApiService } from '../../services/profileApiService';
import { isBackendApiConfigured } from '../../services/backendApiClient';
import { prodamusPaymentService, readPendingProdamusOrderId, ProdamusPaymentStatusResponse } from '../../services/prodamusPaymentService';
import { ScreenContainer } from '../layout/ScreenContainer';

type PremiumSuccessScreenProps = {
  userProfile: UserProfile;
  onPrimaryAction: () => void;
  onBackHome: () => void;
};

type ConfirmationState = 'checking' | 'confirmed' | 'delayed' | 'failed';

const readOrderFromLocation = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('order_id') || params.get('orderId') || params.get('order_num') || readPendingProdamusOrderId();
  } catch {
    return readPendingProdamusOrderId();
  }
};

const wait = (ms: number): Promise<void> => new Promise(resolve => window.setTimeout(resolve, ms));
const nextDelay = (attempt: number): number => attempt < 4 ? 1_000 : attempt < 10 ? 2_000 : 5_000;
const MAX_PAYMENT_STATUS_ATTEMPTS = 16;

export const PremiumSuccessScreen: React.FC<PremiumSuccessScreenProps> = ({ userProfile, onPrimaryAction, onBackHome }) => {
  const [orderId, setOrderId] = useState<string | null>(() => readOrderFromLocation());
  const [confirmedProfile, setConfirmedProfile] = useState<UserProfile | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<ProdamusPaymentStatusResponse | null>(null);
  const [confirmationState, setConfirmationState] = useState<ConfirmationState>(userProfile.premiumExpiresAt ? 'confirmed' : 'checking');
  const effectiveProfile = confirmedProfile || userProfile;
  const kidsMode = isKidsMode(effectiveProfile, true);
  const ctaLabel = kidsMode ? 'Добавить слова ребёнка' : 'Добавить свои слова';
  const ctaHint = kidsMode ? 'Добавьте слова из школы, курса или учебника, чтобы ребёнок повторял их в играх.' : 'Загрузите слова из работы, экзамена, курса или своей темы и тренируйте их в играх.';
  const benefits = kidsMode
    ? ['Детские темы: школа, дом, животные, еда', 'Слова для первых классов', 'Тренировка по словам из школы или курса']
    : ['Тематические словари по задачам', 'Слова по уровням A1–C2', 'Тренировка по вашему списку слов'];
  const confirmed = Boolean(effectiveProfile.premiumExpiresAt);
  const showNextStep = confirmationState === 'confirmed' || confirmed;
  const statusText = useMemo(() => {
    if (showNextStep) return 'Premium активен';
    if (confirmationState === 'failed') return 'Нужна повторная проверка';
    if (confirmationState === 'delayed') return 'Подтверждение задерживается';
    return 'Включаем Premium';
  }, [confirmationState, showNextStep]);

  const syncProfileAfterActivation = async (): Promise<void> => {
    const profile = await profileApiService.getCurrentProfile();
    if (profile.premiumExpiresAt) {
      setConfirmedProfile(profile);
      setConfirmationState('confirmed');
      prodamusPaymentService.forgetPendingOrder(orderId);
      window.dispatchEvent(new CustomEvent('annword:profile-updated', { detail: profile }));
      return;
    }
    setConfirmationState('delayed');
  };

  const checkPaymentOnce = async (): Promise<boolean> => {
    const id = orderId || readOrderFromLocation();
    if (!id) {
      setConfirmationState('delayed');
      return false;
    }
    if (id !== orderId) setOrderId(id);

    const status = await prodamusPaymentService.getPaymentStatus(id);
    setPaymentStatus(status);
    if (status.premiumActive) {
      await syncProfileAfterActivation();
      return true;
    }
    if (status.paymentStatus === 'paid') {
      await syncProfileAfterActivation();
      return confirmed;
    }
    if (status.paymentStatus === 'failed' || status.paymentStatus === 'cancelled' || status.paymentStatus === 'refunded') {
      setConfirmationState('failed');
      return false;
    }
    return false;
  };

  useEffect(() => {
    if (confirmed) {
      setConfirmationState('confirmed');
      return;
    }
    if (!isBackendApiConfigured) {
      setConfirmationState('delayed');
      return;
    }
    let cancelled = false;
    const poll = async () => {
      setConfirmationState('checking');
      for (let attempt = 0; attempt < MAX_PAYMENT_STATUS_ATTEMPTS; attempt += 1) {
        try {
          const done = await checkPaymentOnce();
          if (done || cancelled) return;
        } catch (error) {
          console.warn('Premium payment status refresh failed', error);
        }
        if (cancelled) return;
        await wait(nextDelay(attempt));
      }
      if (!cancelled) setConfirmationState('delayed');
    };
    void poll();
    return () => { cancelled = true; };
  }, [confirmed, orderId]);

  const retry = async (): Promise<void> => {
    setConfirmationState('checking');
    try {
      const done = await checkPaymentOnce();
      if (!done) setConfirmationState('delayed');
    } catch (error) {
      console.warn('Manual Premium payment status refresh failed', error);
      setConfirmationState('delayed');
    }
  };

  const waitingCopy = confirmationState === 'delayed'
    ? 'Оплата могла пройти, но серверное подтверждение задерживается. Можно вернуться на главную или нажать «Проверить ещё раз». Если деньги списались, Premium включится после подтверждения платежа.'
    : confirmationState === 'failed'
      ? 'Оплату не удалось подтвердить. Попробуйте проверить ещё раз или вернитесь к экрану Premium.'
      : 'Оплата принята. AnnWord проверяет статус заказа на сервере и включит Premium автоматически. Обычно это занимает несколько секунд.';

  return <ScreenContainer className="max-w-5xl pb-20 pt-8">
    <section className="overflow-hidden rounded-[2.5rem] border-2 border-green-100 bg-white shadow-sm">
      <div className="grid gap-6 p-6 lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
        <div className="rounded-[2rem] bg-gradient-to-br from-green-50 via-emerald-50 to-indigo-50 p-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white text-5xl shadow-sm" aria-hidden="true">{showNextStep ? '✅' : confirmationState === 'failed' ? '⚠️' : '⏳'}</div>
          <div className="mt-6 inline-flex rounded-full bg-green-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-green-700">{statusText}</div>
          <h1 className="mt-4 text-4xl font-black leading-tight text-indigo-950 sm:text-5xl">{showNextStep ? (kidsMode ? 'Kids Premium подключён' : 'AnnWord Premium подключён') : confirmationState === 'failed' ? 'Оплату нужно проверить' : 'Включаем Premium'}</h1>
          <p className="mt-4 text-base font-bold leading-relaxed text-gray-600">{showNextStep ? 'Доступ уже активирован. Теперь можно выбрать тему или добавить слова, которые нужно повторить в играх.' : waitingCopy}</p>
          {orderId && <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-xs font-black text-indigo-700">Заказ: {orderId}</p>}
          {paymentStatus && !showNextStep && <p className="mt-3 rounded-2xl bg-white/80 px-4 py-3 text-xs font-black text-gray-500">Статус платежа: {paymentStatus.paymentStatus}</p>}
          {effectiveProfile.premiumExpiresAt && <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-black text-green-700">Premium активен до: {formatPremiumExpiresAt(effectiveProfile.premiumExpiresAt)}</p>}
        </div>
        <div className="flex flex-col justify-center">
          {showNextStep ? <>
            <div className="grid gap-3 sm:grid-cols-3">
              {benefits.map(item => <div key={item} className="rounded-3xl border-2 border-indigo-50 bg-indigo-50/70 p-4 text-sm font-black leading-snug text-indigo-900">{item}</div>)}
            </div>
            <div className="mt-6 rounded-[2rem] border-2 border-amber-100 bg-amber-50 p-5">
              <div className="text-xs font-black uppercase tracking-widest text-amber-600">Следующий шаг</div>
              <h2 className="mt-2 text-2xl font-black text-indigo-950">{ctaLabel}</h2>
              <p className="mt-2 text-sm font-bold leading-relaxed text-gray-600">{ctaHint}</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button type="button" onClick={onPrimaryAction} className="rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-700">{ctaLabel}</button>
                <button type="button" onClick={onBackHome} className="rounded-2xl border-2 border-indigo-100 bg-white px-6 py-4 font-black text-indigo-700 transition hover:bg-indigo-50">На главную</button>
              </div>
            </div>
          </> : <div className="rounded-[2rem] border-2 border-indigo-50 bg-indigo-50/60 p-6 text-indigo-950">
            <div className="text-xs font-black uppercase tracking-widest text-indigo-500">Что происходит</div>
            <h2 className="mt-2 text-2xl font-black">Ждём подтверждение платежа</h2>
            <p className="mt-3 text-sm font-bold leading-relaxed text-gray-600">{waitingCopy}</p>
            {confirmationState === 'checking' && <div className="mt-5 h-3 overflow-hidden rounded-full bg-white"><div className="h-full w-1/3 animate-[premiumLoading_1.2s_ease-in-out_infinite] rounded-full bg-indigo-600" /></div>}
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {(confirmationState === 'delayed' || confirmationState === 'failed') && <button type="button" onClick={() => void retry()} className="rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-700">Проверить ещё раз</button>}
              <button type="button" onClick={onBackHome} className="rounded-2xl border-2 border-indigo-100 bg-white px-6 py-4 font-black text-indigo-700 transition hover:bg-indigo-50">На главную</button>
            </div>
            <style>{`@keyframes premiumLoading { 0% { transform: translateX(-120%); } 50% { transform: translateX(120%); } 100% { transform: translateX(320%); } }`}</style>
          </div>}
        </div>
      </div>
    </section>
  </ScreenContainer>;
};
