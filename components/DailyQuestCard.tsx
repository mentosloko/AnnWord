import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { DailyQuestCompletionReward, DailyQuestState } from '../types';
import { getShopImageUrl } from '../services/petAssets';

const londonDate = (timestamp: number): string => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/London',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date(timestamp));

const getNextLondonDayStart = (timestamp: number): number => {
  const currentDate = londonDate(timestamp);
  let low = timestamp;
  let high = timestamp + 27 * 60 * 60 * 1000;
  while (high - low > 1000) {
    const middle = Math.floor((low + high) / 2);
    if (londonDate(middle) === currentDate) low = middle;
    else high = middle;
  }
  return high;
};

const formatQuestCountdown = (): string => {
  const now = Date.now();
  const remainingMinutes = Math.max(0, Math.ceil((getNextLondonDayStart(now) - now) / 60000));
  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return `${hours} ч ${String(minutes).padStart(2, '0')} мин`;
};

export const DailyQuestCard: React.FC<{ quest: DailyQuestState; onStart?: (quest: DailyQuestState) => void }> = ({ quest, onStart }) => {
  const [countdown, setCountdown] = useState(() => formatQuestCountdown());

  useEffect(() => {
    const updateCountdown = () => setCountdown(formatQuestCountdown());
    updateCountdown();
    const timerId = window.setInterval(updateCountdown, 60_000);
    return () => window.clearInterval(timerId);
  }, []);

  const showsProgress = !quest.completed && (quest.kind === 'all_five_games' || quest.kind.startsWith('anagram_'));

  return (
    <section className="mt-5 rounded-3xl border-2 border-purple-100 bg-purple-50/60 p-4 text-left sm:p-5" aria-label="Ежедневное испытание">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-widest text-purple-500">Задание от питомца</p>
          <h2 className="mt-1 text-lg font-black text-indigo-950">{quest.title}</h2>
        </div>
        <div className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${quest.completed ? 'bg-green-100 text-green-700' : 'bg-white text-purple-700'}`}>
          {quest.completed ? 'Выполнено' : countdown}
        </div>
      </div>
      <p className="mt-2 text-sm font-bold leading-relaxed text-gray-600">{quest.description}</p>
      {showsProgress && <p className="mt-2 text-xs font-black text-purple-700">Прогресс: {quest.progressLabel}</p>}
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5">
        <div className="text-2xl" aria-hidden="true">🎁</div>
        <div className="min-w-0 flex-1 text-sm font-bold text-indigo-900">
          {quest.completed ? 'Секретная коробка открыта' : 'Награда: секретная коробка'}
          <div className="text-xs font-bold text-gray-500">Внутри случайное лакомство</div>
        </div>
        {!quest.completed && onStart && <button type="button" onClick={() => onStart(quest)} className="shrink-0 rounded-xl bg-purple-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-purple-700">Играть</button>}
      </div>
    </section>
  );
};

export const DailyQuestRewardModal: React.FC<{ reward: DailyQuestCompletionReward; onClose: () => void }> = ({ reward, onClose }) => {
  const imageUrl = getShopImageUrl(reward.item);
  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-indigo-950/45 px-4 backdrop-blur-sm">
      <motion.div role="dialog" aria-modal="true" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-sm rounded-[2rem] border-2 border-purple-100 bg-white p-6 text-center shadow-2xl">
        <div className="mb-3 inline-flex rounded-full bg-purple-50 px-4 py-1 text-xs font-black uppercase tracking-widest text-purple-700">Задание выполнено</div>
        <div className="text-5xl" aria-hidden="true">🎁</div>
        <h2 className="mt-2 text-2xl font-black text-indigo-950">Секретная коробка!</h2>
        <p className="mt-2 text-sm font-bold text-gray-500">Питомец приготовил награду за сегодняшнее испытание.</p>
        <motion.div initial={{ scale: 0.75, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.18 }} className="mx-auto mt-5 flex h-32 w-32 items-center justify-center rounded-3xl border-2 border-indigo-50 bg-indigo-50/50">
          {imageUrl ? <img src={imageUrl} alt={reward.item.name} className="h-28 w-28 object-contain" /> : <span className="text-6xl">🍬</span>}
        </motion.div>
        <div className="mt-4 text-xs font-black uppercase tracking-widest text-purple-500">Выпало лакомство</div>
        <div className="mt-1 text-xl font-black text-indigo-950">{reward.item.name}</div>
        <button type="button" onClick={onClose} className="mt-6 w-full rounded-2xl bg-indigo-600 px-5 py-3 font-black text-white">Здорово!</button>
      </motion.div>
    </div>
  );
};