import React from 'react';
import { UserProfile } from '../../types';
import { isKidsMode } from '../../services/modeFlags';
import { formatPremiumExpiresAt } from '../../services/premiumAccess';
import { ScreenContainer } from '../layout/ScreenContainer';

export type PaymentReturnStatus = 'success' | 'pending' | 'error';

export type PaymentReturnState = {
  status: PaymentReturnStatus;
  orderId?: string | null;
  reason?: string | null;
};

type PremiumSuccessScreenProps = {
  userProfile: UserProfile;
  paymentReturn?: PaymentReturnState | null;
  onPrimaryAction: () => void;
  onBackHome: () => void;
};

const reasonCopy = (reason?: string | null): string => {
  if (reason === 'missing_order_id') return 'Платёжная форма не передала номер заказа.';
  if (reason === 'order_not_found') return 'Заказ не найден в AnnWord.';
  if (reason === 'activation_failed') return 'Не удалось активировать Premium автоматически.';
  return 'Оплата не была подтверждена.';
};

export const PremiumSuccessScreen: React.FC<PremiumSuccessScreenProps> = ({ userProfile, paymentReturn, onPrimaryAction, onBackHome }) => {
  const status = paymentReturn?.status || 'success';
  const kidsMode = isKidsMode(userProfile, true);
  const isSuccess = status === 'success';
  const isPending = status === 'pending';
  const title = isSuccess
    ? (kidsMode ? 'Kids Premium подключён' : 'AnnWord Premium подключён')
    : isPending
      ? 'Оплата ожидает подтверждения'
      : 'Оплату не удалось подтвердить';
  const ctaLabel = isSuccess ? (kidsMode ? 'Добавить слова ребёнка' : 'Добавить свои слова') : 'Вернуться к Premium';
  const ctaHint = isSuccess
    ? (kidsMode ? 'Добавьте слова из школы, курса или учебника, чтобы ребёнок повторял их в играх.' : 'Загрузите слова из работы, экзамена, курса или своей темы и тренируйте их в играх.')
    : isPending
      ? 'Если деньги списались, Premium включится после серверного подтверждения оплаты. Обновите профиль через несколько минут или вернитесь к экрану Premium.'
      : `${reasonCopy(paymentReturn?.reason)} Попробуйте оплатить ещё раз или передайте номер заказа поддержке.`;
  const benefits = kidsMode
    ? ['Детские темы: школа, дом, животные, еда', 'Слова для первых классов', 'Тренировка по словам из школы или курса']
    : ['Тематические словари по задачам', 'Слова по уровням A1–C2', 'Тренировка по вашему списку слов'];
  const badge = isSuccess ? 'Оплата прошла' : isPending ? 'Проверяем оплату' : 'Нужна повторная проверка';
  const emoji = isSuccess ? '✅' : isPending ? '⏳' : '⚠️';

  return <ScreenContainer className="max-w-5xl pb-20 pt-8">
    <section className="overflow-hidden rounded-[2.5rem] border-2 border-green-100 bg-white shadow-sm">
      <div className="grid gap-6 p-6 lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
        <div className="rounded-[2rem] bg-gradient-to-br from-green-50 via-emerald-50 to-indigo-50 p-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white text-5xl shadow-sm" aria-hidden="true">{emoji}</div>
          <div className="mt-6 inline-flex rounded-full bg-green-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-green-700">{badge}</div>
          <h1 className="mt-4 text-4xl font-black leading-tight text-indigo-950 sm:text-5xl">{title}</h1>
          <p className="mt-4 text-base font-bold leading-relaxed text-gray-600">{ctaHint}</p>
          {paymentReturn?.orderId && <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-xs font-black text-indigo-700">Заказ: {paymentReturn.orderId}</p>}
          {isSuccess && userProfile.premiumExpiresAt && <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-black text-green-700">Premium активен до: {formatPremiumExpiresAt(userProfile.premiumExpiresAt)}</p>}
        </div>
        <div className="flex flex-col justify-center">
          <div className="grid gap-3 sm:grid-cols-3">
            {benefits.map(item => <div key={item} className="rounded-3xl border-2 border-indigo-50 bg-indigo-50/70 p-4 text-sm font-black leading-snug text-indigo-900">{item}</div>)}
          </div>
          <div className="mt-6 rounded-[2rem] border-2 border-amber-100 bg-amber-50 p-5">
            <div className="text-xs font-black uppercase tracking-widest text-amber-600">Следующий шаг</div>
            <h2 className="mt-2 text-2xl font-black text-indigo-950">{ctaLabel}</h2>
            <p className="mt-2 text-sm font-bold leading-relaxed text-gray-600">{isSuccess ? ctaHint : 'После подтверждения оплаты словари и свои слова откроются автоматически.'}</p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={onPrimaryAction} className="rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-indigo-700">{ctaLabel}</button>
              <button type="button" onClick={onBackHome} className="rounded-2xl border-2 border-indigo-100 bg-white px-6 py-4 font-black text-indigo-700 transition hover:bg-indigo-50">На главную</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </ScreenContainer>;
};