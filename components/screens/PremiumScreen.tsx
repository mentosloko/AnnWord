import React from 'react';
import { UserProfile } from '../../types';
import { getKidsDictionaryCatalog } from '../../services/kidsDictionaryCatalog';
import { isKidsMode } from '../../services/modeFlags';
import { formatPremiumExpiresAt } from '../../services/premiumAccess';
import { getPremiumDictionaryCatalog, hasPremiumDictionaryAccess } from '../../services/premiumDictionaryCatalog';
import { ScreenContainer } from '../layout/ScreenContainer';

type PremiumScreenProps = {
  userProfile: UserProfile;
  onBack: () => void;
  onOpenDictionarySetup: () => void;
  onTestUnlockPremium?: () => void;
};

const PAYMENTS_ENABLED = import.meta.env.DEV && import.meta.env.VITE_ENABLE_TEST_PREMIUM_UNLOCK === 'true';

export const PremiumScreen: React.FC<PremiumScreenProps> = ({ userProfile, onBack, onOpenDictionarySetup, onTestUnlockPremium }) => {
  const kidsMode = isKidsMode(userProfile, true);
  const hasPremium = hasPremiumDictionaryAccess(userProfile);
  const dictionaries = kidsMode ? getKidsDictionaryCatalog() : getPremiumDictionaryCatalog();
  const totalWords = dictionaries.reduce((sum, item) => sum + item.wordCount, 0);
  const minWords = Math.min(...dictionaries.map(item => item.wordCount));
  const maxWords = Math.max(...dictionaries.map(item => item.wordCount));
  const premiumTitle = kidsMode ? 'Kids Premium' : 'AnnWord Premium';
  const headline = kidsMode ? 'Расширенные детские словари и кабинет родителя' : '10 тематических словарей с уровнями сложности';
  const body = kidsMode
    ? `Откройте ${totalWords} детских слов по классам и темам: школа, дом, животные, чтение и ежедневные ситуации. Плюс код преподавателя, назначение слов и отчёты для родителя.`
    : `Откройте ${totalWords} игровых слов: Business, Travel, Medicine, IELTS, IT, Finance, Legal, Science, Everyday+ и Food. В словарях есть уровни A1–C2, а каждый набор сейчас содержит от ${minWords} до ${maxWords} слов.`;

  return <ScreenContainer className="max-w-6xl pb-20 pt-6">
    <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-2 rounded-2xl border-2 border-indigo-100 bg-white px-4 py-2 font-black text-indigo-700 transition hover:bg-indigo-50">← Назад</button>
    <section className="overflow-hidden rounded-[2.25rem] border-2 border-amber-100 bg-white shadow-sm">
      <div className="grid gap-6 p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-8">
        <div>
          <div className="inline-flex rounded-full bg-amber-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-amber-600">{premiumTitle}</div>
          <h1 className="mt-5 text-4xl font-black leading-tight text-indigo-950 sm:text-5xl">{headline}</h1>
          <p className="mt-4 max-w-2xl text-base font-bold leading-relaxed text-gray-600">{body}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-3xl border-2 border-indigo-50 bg-indigo-50/60 p-4"><div className="text-3xl font-black text-indigo-700">{dictionaries.length}</div><div className="text-xs font-black uppercase tracking-widest text-indigo-400">словарей</div></div>
            <div className="rounded-3xl border-2 border-purple-50 bg-purple-50/60 p-4"><div className="text-3xl font-black text-purple-700">{totalWords}</div><div className="text-xs font-black uppercase tracking-widest text-purple-400">слов</div></div>
            <div className="rounded-3xl border-2 border-green-50 bg-green-50/60 p-4"><div className="text-3xl font-black text-green-700">A1–C2</div><div className="text-xs font-black uppercase tracking-widest text-green-400">уровни</div></div>
          </div>
          {kidsMode && <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {['Код преподавателя', 'Слова в активный словарь', 'Отчёты на почту'].map(item => <div key={item} className="rounded-2xl border-2 border-amber-100 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800">{item}</div>)}
          </div>}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {hasPremium ? <button type="button" onClick={onOpenDictionarySetup} className="rounded-2xl bg-indigo-600 px-6 py-4 font-black text-white shadow-sm transition hover:bg-indigo-700">{kidsMode ? 'Выбрать детский словарь' : 'Выбрать Premium-словарь'}</button> : PAYMENTS_ENABLED && onTestUnlockPremium ? <button type="button" onClick={onTestUnlockPremium} className="rounded-2xl bg-amber-500 px-6 py-4 font-black text-white shadow-sm transition hover:bg-amber-600">Открыть Premium на 7 дней</button> : <button type="button" disabled className="rounded-2xl bg-gray-100 px-6 py-4 font-black text-gray-400">Оплата скоро будет подключена</button>}
            <button type="button" onClick={onBack} className="rounded-2xl border-2 border-indigo-100 bg-white px-6 py-4 font-black text-indigo-700 transition hover:bg-indigo-50">Вернуться</button>
          </div>
          {hasPremium ? <p className="mt-3 text-xs font-bold leading-relaxed text-gray-400">Premium активен до: {formatPremiumExpiresAt(userProfile.premiumExpiresAt)}.</p> : <p className="mt-3 text-xs font-bold leading-relaxed text-gray-400">В production тестовое открытие Premium отключено. Доступ будет выдаваться после оплаты или бесплатного временного доступа.</p>}
        </div>
        <div className="rounded-[2rem] border-2 border-amber-100 bg-amber-50/60 p-4">
          <div className="grid grid-cols-2 gap-3">
            {dictionaries.map(item => <div key={item.id} className="rounded-2xl border-2 border-white bg-white p-3 shadow-sm"><div className="flex items-center justify-between gap-2"><span className="text-2xl" aria-hidden="true">{item.icon}</span><span className="text-sm">{hasPremium ? '✅' : '🔒'}</span></div><div className="mt-2 truncate text-sm font-black text-indigo-950">{item.shortTitle}</div><div className="text-xs font-black text-amber-700">{item.wordCount} слов · A1–C2</div></div>)}
          </div>
        </div>
      </div>
    </section>
  </ScreenContainer>;
};
