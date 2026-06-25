import React, { useEffect, useMemo, useState } from 'react';
import { UserProfile } from '../../types';
import { isKidsMode } from '../../services/modeFlags';
import { formatPremiumExpiresAt } from '../../services/premiumAccess';
import { profileApiService } from '../../services/profileApiService';
import { isBackendApiConfigured } from '../../services/backendApiClient';
import { ScreenContainer } from '../layout/ScreenContainer';

type PremiumSuccessScreenProps = {
  userProfile: UserProfile;
  onPrimaryAction: () => void;
  onBackHome: () => void;
};

export const PremiumSuccessScreen: React.FC<PremiumSuccessScreenProps> = ({ userProfile, onPrimaryAction, onBackHome }) => {
  const [confirmedProfile, setConfirmedProfile] = useState<UserProfile | null>(null);
  const effectiveProfile = confirmedProfile || userProfile;
  const kidsMode = isKidsMode(effectiveProfile, true);
  const title = kidsMode ? 'Kids Premium почти готов' : 'AnnWord Premium почти готов';
  const ctaLabel = kidsMode ? 'Добавить слова ребёнка' : 'Добавить свои слова';
  const ctaHint = kidsMode ? 'Добавьте слова из школы, курса или учебника, чтобы ребёнок повторял их в играх.' : 'Загрузите слова из работы, экзамена, курса или своей темы и тренируйте их в играх.';
  const benefits = kidsMode
    ? ['Детские темы: школа, дом, животные, еда', 'Слова для первых классов', 'Тренировка по словам из школы или курса']
    : ['Тематические словари по задачам', 'Слова по уровням A1–C2', 'Тренировка по вашему списку слов'];
  const confirmed = Boolean(effectiveProfile.premiumExpiresAt);
  const statusText = useMemo(() => confirmed ? 'Premium активен' : 'Синхронизируем оплату', [confirmed]);

  useEffect(() => {
    if (confirmed || !isBackendApiConfigured) return;
    let cancelled = false;
    let attempts = 0;
    const poll = async () => {
      attempts += 1;
      try {
        const profile = await profileApiService.getCurrentProfile();
        if (cancelled) return;
        if (profile.premiumExpiresAt) {
          setConfirmedProfile(profile);
          window.dispatchEvent(new CustomEvent('annword:profile-updated', { detail: profile }));
          return;
        }
      } catch (error) {
        console.warn('Premium status refresh failed', error);
      }
      if (!cancelled && attempts < 12) window.setTimeout(poll, attempts < 4 ? 1000 : 2000);
    };
    void poll();
    return () => { cancelled = true; };
  }, [confirmed]);

  return <ScreenContainer className="max-w-5xl pb-20 pt-8">
    <section className="overflow-hidden rounded-[2.5rem] border-2 border-green-100 bg-white shadow-sm">
      <div className="grid gap-6 p-6 lg:grid-cols-[0.9fr_1.1fr] lg:p-8">
        <div className="rounded-[2rem] bg-gradient-to-br from-green-50 via-emerald-50 to-indigo-50 p-6">
          <div className="flex h-24 w-24 items-center justify-center rounded-[2rem] bg-white text-5xl shadow-sm" aria-hidden="true">✅</div>
          <div className="mt-6 inline-flex rounded-full bg-green-100 px-4 py-2 text-xs font-black uppercase tracking-widest text-green-700">{statusText}</div>
          <h1 className="mt-4 text-4xl font-black leading-tight text-indigo-950 sm:text-5xl">{confirmed ? (kidsMode ? 'Kids Premium подключён' : 'AnnWord Premium подключён') : title}</h1>
          <p className="mt-4 text-base font-bold leading-relaxed text-gray-600">{confirmed ? 'Доступ уже активирован. Теперь можно выбрать тему или добавить слова, которые нужно повторить в играх.' : 'Оплата принята. AnnWord проверяет подтверждение платежа и сам обновит статус Premium без перезагрузки страницы.'}</p>
          {effectiveProfile.premiumExpiresAt && <p className="mt-4 rounded-2xl bg-white/80 px-4 py-3 text-sm font-black text-green-700">Premium активен до: {formatPremiumExpiresAt(effectiveProfile.premiumExpiresAt)}</p>}
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
