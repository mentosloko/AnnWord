import React from 'react';

export const experienceUi = {
  pageTitle: 'text-3xl font-bold tracking-tight text-indigo-950 sm:text-4xl',
  sectionTitle: 'text-xl font-bold text-indigo-950 sm:text-2xl',
  eyebrow: 'text-xs font-bold uppercase tracking-wider text-indigo-500',
  body: 'text-sm font-medium leading-relaxed text-slate-600',
  card: 'rounded-3xl bg-white shadow-sm ring-1 ring-indigo-100/80',
  primaryButton: 'rounded-2xl bg-indigo-600 px-5 py-3 font-bold text-white shadow-sm transition hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500',
  secondaryButton: 'rounded-2xl bg-indigo-50 px-5 py-3 font-bold text-indigo-700 transition hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-60',
} as const;

export type ExperienceTab<T extends string> = { id: T; label: string; badge?: string | number };

export const SegmentedTabs = <T extends string>({ tabs, value, onChange, ariaLabel }: { tabs: ExperienceTab<T>[]; value: T; onChange: (value: T) => void; ariaLabel: string }) => (
  <div role="tablist" aria-label={ariaLabel} className="grid w-full grid-flow-col auto-cols-fr gap-1 rounded-2xl bg-indigo-50 p-1">
    {tabs.map(tab => <button key={tab.id} type="button" role="tab" aria-selected={value === tab.id} onClick={() => onChange(tab.id)} className={`min-w-0 rounded-xl px-3 py-2.5 text-sm font-bold transition ${value === tab.id ? 'bg-white text-indigo-800 shadow-sm' : 'text-indigo-500 hover:bg-white/60 hover:text-indigo-700'}`}><span className="truncate">{tab.label}</span>{tab.badge !== undefined && <span className="ml-1 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] text-indigo-700">{tab.badge}</span>}</button>)}
  </div>
);

export const SectionCard: React.FC<{ children: React.ReactNode; className?: string; as?: 'section' | 'div' }> = ({ children, className = '', as = 'section' }) => {
  const Tag = as;
  return <Tag className={`${experienceUi.card} p-4 sm:p-6 ${className}`}>{children}</Tag>;
};

export const ExperienceState: React.FC<{ kind?: 'loading' | 'empty' | 'error' | 'success'; title: string; description?: string; actionLabel?: string; onAction?: () => void; compact?: boolean }> = ({ kind = 'empty', title, description, actionLabel, onAction, compact = false }) => {
  const icon = kind === 'loading' ? '…' : kind === 'error' ? '!' : kind === 'success' ? '✓' : '○';
  const tone = kind === 'error' ? 'bg-rose-50 text-rose-700' : kind === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700';
  return <div role={kind === 'error' ? 'alert' : 'status'} aria-live="polite" className={`rounded-2xl ${tone} ${compact ? 'p-3' : 'p-5 text-center'}`}>
    <div className={`${compact ? 'flex items-start gap-3' : ''}`}>
      <span aria-hidden="true" className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/80 text-lg font-bold ${kind === 'loading' ? 'animate-pulse' : ''}`}>{icon}</span>
      <div className={compact ? 'min-w-0' : 'mt-3'}><div className="font-bold">{title}</div>{description && <p className="mt-1 text-sm font-medium leading-relaxed opacity-80">{description}</p>}</div>
    </div>
    {actionLabel && onAction && <button type="button" onClick={onAction} className="mt-4 rounded-xl bg-white px-4 py-2 text-sm font-bold shadow-sm">{actionLabel}</button>}
  </div>;
};

export const MetricCard: React.FC<{ value: React.ReactNode; label: string; hint?: string }> = ({ value, label, hint }) => <div className="rounded-2xl bg-indigo-50/70 p-4"><div className="text-2xl font-bold text-indigo-950 sm:text-3xl">{value}</div><div className="mt-1 text-xs font-bold uppercase tracking-wide text-indigo-500">{label}</div>{hint && <div className="mt-2 text-xs font-medium leading-relaxed text-slate-500">{hint}</div>}</div>;
