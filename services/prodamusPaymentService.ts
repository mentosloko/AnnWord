import { supabase } from '../supabase';

export type ProdamusPlanCode = 'kids_month' | 'kids_year';

export interface ProdamusPlanOption {
  code: ProdamusPlanCode;
  title: string;
  amountRub: number;
  periodDays: number;
}

export const PRODAMUS_PLAN_OPTIONS: ProdamusPlanOption[] = [
  { code: 'kids_month', title: 'AnnWord Premium — 1 месяц', amountRub: 300, periodDays: 31 },
  { code: 'kids_year', title: 'AnnWord Premium — 1 год', amountRub: 3000, periodDays: 365 },
];

export interface ProdamusPaymentResponse {
  orderId: string;
  checkoutUrl: string;
  plan: ProdamusPlanOption;
}

export const prodamusPaymentService = {
  createPayment: async (planCode: ProdamusPlanCode): Promise<ProdamusPaymentResponse> => {
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session?.access_token) throw new Error('Для покупки Premium нужно войти в аккаунт.');

    const response = await fetch('/api/payments/prodamus/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${data.session.access_token}`,
      },
      body: JSON.stringify({ planCode }),
    });

    const payload = await response.json().catch(() => null) as { error?: string } | ProdamusPaymentResponse | null;
    if (!response.ok) throw new Error(payload && 'error' in payload && payload.error ? payload.error : 'Не удалось создать платёж.');
    if (!payload || !('checkoutUrl' in payload)) throw new Error('Сервер не вернул ссылку оплаты.');
    return payload;
  },
};