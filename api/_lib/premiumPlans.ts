export type ProdamusPlanCode = 'kids_month' | 'kids_year' | 'practice_month' | 'practice_year';

export interface PremiumPlan {
  code: ProdamusPlanCode;
  title: string;
  description: string;
  amountRub: number;
  periodDays: number;
  mode: 'kids' | 'practice';
}

export const PREMIUM_PLANS: Record<ProdamusPlanCode, PremiumPlan> = {
  kids_month: {
    code: 'kids_month',
    title: 'AnnWord Kids Premium — 1 месяц',
    description: 'Kids Premium на 1 месяц: детские темы, собственные слова и функции кабинета родителя.',
    amountRub: 300,
    periodDays: 31,
    mode: 'kids',
  },
  kids_year: {
    code: 'kids_year',
    title: 'AnnWord Kids Premium — 1 год',
    description: 'Kids Premium на 1 год: детские темы, собственные слова и функции кабинета родителя.',
    amountRub: 3000,
    periodDays: 365,
    mode: 'kids',
  },
  practice_month: {
    code: 'practice_month',
    title: 'AnnWord Premium — 1 месяц',
    description: 'Practice Premium на 1 месяц: тематические словари и тренировки по собственным словам.',
    amountRub: 300,
    periodDays: 31,
    mode: 'practice',
  },
  practice_year: {
    code: 'practice_year',
    title: 'AnnWord Premium — 1 год',
    description: 'Practice Premium на 1 год: тематические словари и тренировки по собственным словам.',
    amountRub: 3000,
    periodDays: 365,
    mode: 'practice',
  },
};

export const getPlan = (value: unknown): PremiumPlan | null => typeof value === 'string' && value in PREMIUM_PLANS
  ? PREMIUM_PLANS[value as ProdamusPlanCode]
  : null;

export const getPublicPlans = () => Object.values(PREMIUM_PLANS).map(plan => ({
  code: plan.code,
  title: plan.title,
  amountRub: plan.amountRub,
  periodDays: plan.periodDays,
  mode: plan.mode,
}));