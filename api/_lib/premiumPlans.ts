export type ProdamusPlanCode = 'kids_month' | 'kids_year';

export interface PremiumPlan {
  code: ProdamusPlanCode;
  title: string;
  description: string;
  amountRub: number;
  periodDays: number;
}

export const PREMIUM_PLANS: Record<ProdamusPlanCode, PremiumPlan> = {
  kids_month: {
    code: 'kids_month',
    title: 'AnnWord Kids Premium — 1 месяц',
    description: 'Kids Premium на 1 месяц: расширенные детские словари, код преподавателя, назначение слов и отчёты.',
    amountRub: 300,
    periodDays: 31,
  },
  kids_year: {
    code: 'kids_year',
    title: 'AnnWord Kids Premium — 1 год',
    description: 'Kids Premium на 1 год: расширенные детские словари, код преподавателя, назначение слов и отчёты.',
    amountRub: 3000,
    periodDays: 365,
  },
};

export const getPlan = (value: unknown): PremiumPlan | null => {
  if (value === 'kids_month' || value === 'kids_year') return PREMIUM_PLANS[value];
  return null;
};

export const getPublicPlans = () => Object.values(PREMIUM_PLANS).map(plan => ({
  code: plan.code,
  title: plan.title,
  amountRub: plan.amountRub,
  periodDays: plan.periodDays,
}));
