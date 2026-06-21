import React from 'react';
import { DailyQuestState } from '../types';

interface QuestContextBannerProps {
  quest?: DailyQuestState | null;
  compact?: boolean;
}

export const QuestContextBanner: React.FC<QuestContextBannerProps> = ({ quest, compact = false }) => {
  if (!quest) return null;
  return <section aria-label="Контекст задания" className={`${compact ? 'rounded-2xl px-3 py-2 text-xs' : 'rounded-3xl px-4 py-3 text-sm'} border-2 border-purple-100 bg-purple-50/90 font-bold text-purple-900 shadow-sm`}>
    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-widest text-purple-500">Задание активно</div>
        <div className="truncate font-black text-indigo-950">{quest.title}</div>
      </div>
      <div className="shrink-0 rounded-full bg-white px-3 py-1 text-[11px] font-black text-purple-700">{quest.progressLabel}</div>
    </div>
    {!compact && <p className="mt-2 leading-relaxed text-purple-800/80">{quest.description}</p>}
  </section>;
};