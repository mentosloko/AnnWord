import React, { useEffect, useMemo, useState } from 'react';
import { getRecentFixedWords, getWordLearningSummary } from '../../services/wordLearningStats';
import { prodamusPaymentService, PremiumPaymentHistoryItem } from '../../services/prodamusPaymentService';
import { formatPremiumExpiresAt, isPremiumActive } from '../../services/premiumAccess';
import { UserProfile } from '../../types';
import { ReviewWordList } from '../ReviewWordList';
import { ScreenContainer } from '../layout/ScreenContainer';
import { ExperienceState, MetricCard, SectionCard, SegmentedTabs, experienceUi } from '../ui/ExperiencePrimitives';

interface ProfileScreenProps { userProfile: UserProfile; isAuthenticated: boolean; activeDictionaryName?: string; onBackHome: () => void; onOpenShop: () => void; onOpenPetRoom: () => void; onLogin: () => void; }
type Tab = 'overview' | 'words' | 'subscription';
const paymentStatusLabel: Record<string, string> = { pending: 'Ожидает оплаты', paid: 'Оплачено', failed: 'Ошибка', cancelled: 'Отменено', refunded: 'Возвращено', ignored: 'Не оплачено', not_found: 'Не найдено' };
const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
const planLabel = (code: string) => code.includes('year') ? 'Premium на 1 год' : 'Premium на 1 месяц';

export const ProfileScreen: React.FC<ProfileScreenProps> = ({ userProfile, isAuthenticated, activeDictionaryName, onBackHome, onOpenShop, onOpenPetRoom, onLogin }) => {
  const isKids = userProfile.role === 'parent' || userProfile.accountMode === 'parent';
  const isTeacher = userProfile.role === 'teacher' || userProfile.accountMode === 'teacher';
  const premium = isPremiumActive(userProfile);
  const learning = useMemo(() => getWordLearningSummary(userProfile.stats), [userProfile.stats]);
  const recentFixed = useMemo(() => getRecentFixedWords(userProfile.stats, 12), [userProfile.stats]);
  const [tab, setTab] = useState<Tab>('overview');
  const [payments, setPayments] = useState<PremiumPaymentHistoryItem[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated || isTeacher || tab !== 'subscription') return;
    let cancelled = false;
    setPaymentsLoading(true); setPaymentsError(null);
    prodamusPaymentService.listPayments().then(items => { if (!cancelled) setPayments(items); }).catch(() => { if (!cancelled) setPaymentsError('Не удалось загрузить историю оплат.'); }).finally(() => { if (!cancelled) setPaymentsLoading(false); });
    return () => { cancelled = true; };
  }, [isAuthenticated, isTeacher, tab, userProfile.subscriptionTier, userProfile.premiumExpiresAt]);

  const title = !isAuthenticated ? 'Гость' : isTeacher ? 'AnnWord Teacher' : isKids ? 'AnnWord Kids' : 'AnnWord Practice';
  const tabs = isTeacher ? [{ id: 'overview' as const, label: 'Обзор' }] : [
    { id: 'overview' as const, label: 'Обзор' },
    { id: 'words' as const, label: 'Слова', badge: learning.activeReview.length },
    { id: 'subscription' as const, label: 'Подписка' },
  ];

  return <ScreenContainer className="max-w-5xl pb-24 pt-4 sm:pb-20 sm:pt-6">
    <div className="mb-4 flex items-center justify-between gap-3"><button type="button" onClick={onBackHome} className={experienceUi.secondaryButton}>← На главную</button>{!isAuthenticated && <button type="button" onClick={onLogin} className={experienceUi.primaryButton}>Войти</button>}</div>
    <section className="rounded-[2rem] bg-gradient-to-br from-indigo-700 to-purple-700 p-5 text-white shadow-xl sm:p-8"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><div className="text-xs font-bold uppercase tracking-wider text-white/65">{title}</div><h1 className="mt-2 text-3xl font-bold sm:text-5xl">{userProfile.username || title}</h1><p className="mt-2 text-sm font-medium text-white/75">{isTeacher ? 'Ученики, словари и задания.' : isKids ? 'Игры, питомец и прогресс ребёнка.' : 'Результаты тренировок и слова для повторения.'}</p></div>{premium && <span className="w-max rounded-full bg-white/15 px-4 py-2 text-sm font-bold ring-1 ring-white/20">✦ Premium до {formatPremiumExpiresAt(userProfile.premiumExpiresAt)}</span>}</div></section>
    <div className="mt-5"><SegmentedTabs tabs={tabs} value={tab} onChange={setTab} ariaLabel="Разделы профиля" /></div>

    {tab === 'overview' && <div className="mt-5 space-y-5">
      <SectionCard><div className={experienceUi.eyebrow}>Главные показатели</div><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4"><MetricCard value={userProfile.stats.gamesPlayed} label="тренировок" /><MetricCard value={userProfile.stats.gamesWon} label="успешных" />{isKids && <><MetricCard value={userProfile.coins} label="монет" /><MetricCard value={userProfile.pet.level} label="уровень" /></>}{isTeacher && <MetricCard value={(userProfile.dictionaryCollections || []).length} label="словарей" />}{!isKids && !isTeacher && <><MetricCard value={learning.fixedAfterMistake.length} label="исправлено" /><MetricCard value={learning.activeReview.length} label="к повторению" /></>}</div></SectionCard>
      {!isTeacher && <SectionCard><div className={experienceUi.eyebrow}>Сейчас используется</div><h2 className="mt-2 text-xl font-bold text-indigo-950">{activeDictionaryName || 'Активный словарь'}</h2><p className="mt-2 text-sm font-medium text-slate-500">Новые игры запускаются с этим словарём и последними настройками.</p></SectionCard>}
      {userProfile.stats.gamesPlayed === 0 && !isTeacher && <ExperienceState title="Здесь появится ваш прогресс" description="Завершите любую игру — мы покажем тренировки, успешные ответы и слова, которые нужно повторить." actionLabel="Вернуться к играм" onAction={onBackHome} />}
      {isKids && <div className="grid gap-3 sm:grid-cols-2"><button type="button" onClick={onOpenPetRoom} className={experienceUi.primaryButton}>Комната питомца</button><button type="button" onClick={onOpenShop} className={experienceUi.secondaryButton}>Магазин</button></div>}
    </div>}

    {tab === 'words' && <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <SectionCard><div className="flex items-center justify-between gap-3"><div><div className="text-xs font-bold uppercase tracking-wider text-rose-500">Нужно закрепить</div><h2 className="mt-1 text-xl font-bold text-indigo-950">Слова для повторения</h2></div><span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-bold text-rose-700">{learning.activeReview.length}</span></div><p className="mt-2 text-sm font-medium text-slate-500">Нажмите на слово, чтобы увидеть перевод. Эти слова будут появляться в играх чаще.</p>{learning.activeReview.length ? <ReviewWordList words={learning.activeReview.map(item => item.word)} className="mt-4" /> : <div className="mt-4"><ExperienceState compact kind="success" title="Сейчас нет сложных слов" description="Все активные ошибки уже закрыты правильными ответами." /></div>}</SectionCard>
      <SectionCard><div className="text-xs font-bold uppercase tracking-wider text-emerald-600">Уже получается</div><h2 className="mt-1 text-xl font-bold text-indigo-950">Исправленные слова</h2><p className="mt-2 text-sm font-medium text-slate-500">Слова, в которых раньше были ошибки, а затем появился правильный ответ.</p><div className="mt-4 flex flex-wrap gap-2">{recentFixed.length ? recentFixed.map(item => <span key={item.word} className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">{item.word}</span>) : <ExperienceState compact title="Пока пусто" description="После исправленных ошибок здесь появятся первые слова." />}</div></SectionCard>
    </div>}

    {tab === 'subscription' && !isTeacher && <div className="mt-5 space-y-5"><SectionCard><div className="flex items-start justify-between gap-3"><div><div className={experienceUi.eyebrow}>Premium</div><h2 className="mt-1 text-2xl font-bold text-indigo-950">{premium ? 'Доступ подключён' : 'Бесплатный план'}</h2><p className="mt-2 text-sm font-medium text-slate-500">{premium ? `Действует до ${formatPremiumExpiresAt(userProfile.premiumExpiresAt)}.` : 'Базовые игры и встроенный словарь доступны бесплатно.'}</p></div>{premium && <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-bold text-amber-700">✦ активен</span>}</div></SectionCard>
      <SectionCard><div className={experienceUi.eyebrow}>История оплат</div>{paymentsLoading ? <div className="mt-4"><ExperienceState kind="loading" title="Загружаю оплаты" /></div> : paymentsError ? <div className="mt-4"><ExperienceState kind="error" title="История недоступна" description={paymentsError} /></div> : payments.length ? <div className="mt-4 grid gap-3">{payments.map(payment => <div key={payment.orderId} className="rounded-2xl bg-amber-50/60 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="font-bold text-indigo-950">{planLabel(payment.planCode)}</div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${payment.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : payment.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>{paymentStatusLabel[payment.status] || payment.status}</span></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-slate-500"><span>{payment.amountRub.toLocaleString('ru-RU')} ₽</span><span>{formatDate(payment.createdAt)}</span><span className="break-all">Заказ: {payment.orderId}</span></div></div>)}</div> : <div className="mt-4"><ExperienceState title="Оплат пока нет" description="После покупки Premium здесь появится информация о заказе." /></div>}</SectionCard>
    </div>}
  </ScreenContainer>;
};
