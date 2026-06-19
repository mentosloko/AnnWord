import React from 'react';
import { UserProfile } from '../../types';
import { isKidsMode } from '../../services/modeFlags';
import { formatPremiumExpiresAt } from '../../services/premiumAccess';
import { ScreenContainer } from '../layout/ScreenContainer';

type PremiumSuccessScreenProps = {
  userProfile: UserProfile;
  onPrimaryAction: () => void;
  onBackHome: () => void;
};

export const PremiumSuccessScreen: React.FC<PremiumSuccessScreenProps> = ({ userProfile, onPrimaryAction, onBackHome }) => {
  const kidsMode = isKidsMode(userProfile, true);
  const title = kidsMode ? 'Kids Premium подключён' : 'AnnWord Premium подключён';
  const ctaLabel = kidsMode ? 'Открыть «Мой словарь»' : 'Подключить кастомный словарь';
  const ctaHint = kidsMode ? 'Выберите детский словарь, добавьте свои слова или подготовьте набор для занятий.' : 'Загрузите свой словарь или выберите Premium-набор для практики.';
  const benefits = kidsMode
    ? ['Расширенные детские словари по темам', 'Кабинет родителя и код преподавателя', 'Назначение слов и отчёты по занятиям']
    : ['Premium-словари по темам и уровням', 'Кастомные словари для Practice', 'Больше игровых сценариев для повторения слов'];

  return <ScreenContainer className="max-w-5xl pb-20 pt-8">
    <section className="overflow-hidden rounded-[2.5rem] border-2 border-green-100 bg-white shadow-sm">
      <div className="grid gap-6 p-6 lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
        <div className="rounded-[2rem] bg-gradient-to-br from-green-50 via-emerald-50 to-indigo-50 p-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white text-5xl shadow-sm" aria-hidden="true">✅</div>
          <div className="mt-6 inline-flex rounded-full bg-green-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-green-700">Оплата прошла</div>
          <h1 className="mt-4 text-4xl font-black leading-tight text-indigo-950 sm:text-5xl">{title}</h1>
          <p className="mt-4 text-base font-bold leading-relaxed text-gray-600">Доступ уже активирован. Можно сразу подключить словарь и продолжить обучение без лишних шагов.</p>
          {userProfile.premiumExpiresAt && <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-black text-green-700">Premium активен до: {formatPremiumExpiresAt(userProfile.premiumExpiresAt)}</p>}
        </div>
        <div className="flex flex-col justify-center">
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
        </div>
      </div>
    </section>
  </ScreenContainer>;
};
