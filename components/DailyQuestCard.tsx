import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { DailyQuestCompletionReward, DailyQuestState } from '../types';
import { assetUrl } from '../services/assetUrl';
import { getShopImageUrl } from '../services/petAssets';
import { getWorld } from '../services/premiumFeatureCatalog';
import { experienceUi } from './ui/ExperiencePrimitives';

const MYSTERY_BOX_IMAGE = assetUrl('/assets/rewards/mystery-box.webp');
const moscowDateKey = (date: Date): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const getDailyQuestCountdown = (): string => { const now = new Date(), key = moscowDateKey(now); let minutes = 1; for (; minutes <= 1500; minutes += 1) if (moscowDateKey(new Date(now.getTime() + minutes * 60000)) !== key) break; return `${Math.floor(minutes / 60)} ч ${String(minutes % 60).padStart(2, '0')} мин`; };
const streakLabel = (days: number): string => { const value = Math.max(0, Math.round(days || 0)), mod10 = value % 10, mod100 = value % 100; const noun = mod10 === 1 && mod100 !== 11 ? 'день подряд' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'дня подряд' : 'дней подряд'; return `${value} ${noun}`; };

export const DailyQuestCard: React.FC<{ quest: DailyQuestState; onStart?: (quest: DailyQuestState) => void; variant?: 'kids' | 'practice'; onOpenPetRoom?: () => void; onOpenShop?: () => void; streakDays?: number }> = ({ quest, onStart, variant = 'kids', onOpenPetRoom, streakDays = 0 }) => {
  const [countdown, setCountdown] = useState(getDailyQuestCountdown);
  const isPractice = variant === 'practice';
  const safeStreak = Math.max(0, Math.round(streakDays || 0));
  useEffect(() => { const timer = window.setInterval(() => setCountdown(getDailyQuestCountdown()), 60000); return () => window.clearInterval(timer); }, []);
  return <section className={`mt-5 rounded-3xl p-4 ring-1 sm:p-5 ${quest.completed ? 'bg-emerald-50/70 ring-emerald-100' : 'bg-purple-50/70 ring-purple-100'}`} aria-label="Ежедневное задание">
    <div className="flex items-start justify-between gap-3"><div><p className={`text-xs font-bold uppercase tracking-wider ${quest.completed ? 'text-emerald-600' : 'text-purple-600'}`}>{isPractice ? 'Ежедневная практика' : 'Задание от питомца'}</p><h2 className="mt-1 text-xl font-bold text-indigo-950">{quest.title}</h2></div>{quest.completed ? <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700">✓</span> : <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-purple-700">{countdown}</span>}</div>
    <p className="mt-2 text-sm font-medium leading-relaxed text-slate-600">{quest.description}</p>
    {quest.kind === 'all_five_games' && !quest.completed && <p className="mt-2 text-xs font-bold text-purple-700">Прогресс: {quest.progressLabel}</p>}
    {quest.completed && safeStreak > 0 && <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-emerald-700"><span aria-hidden="true">🔥</span>{streakLabel(safeStreak)}</div>}
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3"><div className="min-w-0"><div className="font-bold text-indigo-950">{quest.completed ? 'Задание выполнено' : 'Короткая тренировка'}</div><div className="mt-1 text-xs font-medium text-slate-500">{quest.completed ? isPractice ? 'Можно выбрать любую другую игру.' : 'Награда уже добавлена.' : 'Начните с рекомендованного режима.'}</div></div>{!quest.completed && onStart && <button type="button" onClick={() => onStart(quest)} className={experienceUi.primaryButton}>Играть</button>}{quest.completed && !isPractice && onOpenPetRoom && <button type="button" onClick={onOpenPetRoom} className={experienceUi.secondaryButton}>К питомцу</button>}</div>
  </section>;
};

export const DailyQuestRewardModal: React.FC<{ reward: DailyQuestCompletionReward; onClose: () => void; onOpenPetRoom?: () => void; onOpenShop?: () => void; streakDays?: number }> = ({ reward, onClose, onOpenPetRoom, streakDays = 0 }) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const world = reward.worldId ? getWorld(reward.worldId) : null;
  const imageUrl = reward.item ? getShopImageUrl(reward.item) : null;
  const safeStreak = Math.max(0, Math.round(streakDays || 0));
  const pending = reward.pending === true;
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusTimer = window.setTimeout(() => dialogRef.current?.focus(), 0);
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !pending) onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => { window.clearTimeout(focusTimer); document.body.style.overflow = previousOverflow; window.removeEventListener('keydown', onKeyDown); };
  }, [onClose, pending]);
  const openPet = () => { onClose(); onOpenPetRoom?.(); };
  return <div className="fixed inset-0 z-[95] flex items-center justify-center bg-indigo-950/50 p-3 backdrop-blur-sm" role="presentation"><motion.div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="daily-quest-reward-title" aria-describedby="daily-quest-reward-description" tabIndex={-1} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="max-h-[calc(100dvh-1.5rem)] w-full max-w-sm overflow-y-auto rounded-[2rem] bg-white p-6 text-center shadow-2xl outline-none ring-1 ring-purple-100">
    <div className="inline-flex rounded-full bg-purple-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-purple-700">Задание выполнено</div>
    <motion.div initial={{ scale: 0.75, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.12 }} className={`mx-auto mt-5 flex h-36 w-36 items-center justify-center rounded-3xl ${world ? `bg-gradient-to-b ${world.backgroundClass}` : 'bg-indigo-50'}`}>{world ? <span className="text-6xl">{world.emoji}</span> : imageUrl && reward.item ? <img src={imageUrl} alt={reward.item.name} className="h-28 w-28 object-contain" /> : <img src={MYSTERY_BOX_IMAGE} alt="" className="h-24 w-24 object-contain" />}</motion.div>
    <h2 id="daily-quest-reward-title" className="mt-4 text-3xl font-bold text-indigo-950">{pending ? 'Начисляем награду' : world ? 'Новый фон открыт!' : 'Награда получена!'}</h2><p id="daily-quest-reward-description" className="mt-2 text-sm font-medium leading-relaxed text-slate-500">{pending ? 'Сохраняем результат. Не закрывайте окно.' : world ? `Теперь доступно место «${world.title}».` : reward.item ? `Питомец получил: ${reward.item.name}.` : 'Результат сохранён.'}</p>
    {safeStreak > 0 && <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700"><span aria-hidden="true">🔥</span>{streakLabel(safeStreak)}</div>}
    <div className="mt-6 grid gap-2">{pending ? <div role="status" className="rounded-2xl bg-indigo-50 px-5 py-3 font-bold text-indigo-700">Сохраняем результат…</div> : <><button type="button" onClick={onClose} className={`w-full ${experienceUi.primaryButton}`}>Забрать награду</button>{onOpenPetRoom && <button type="button" onClick={openPet} className={`w-full ${experienceUi.secondaryButton}`}>В комнату питомца</button>}</>}</div>
  </motion.div></div>;
};
