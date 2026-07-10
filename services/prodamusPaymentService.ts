import { supabase } from '../supabase';
import { BackendApiError, backendApiRequest, isBackendApiConfigured } from './backendApiClient';

export type ProdamusPlanCode = 'kids_month' | 'kids_year';
export type ProdamusPaymentStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'ignored' | 'not_found';

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

export interface ProdamusPaymentStatusResponse {
  status: 'ok' | 'not_found';
  orderId: string;
  providerPaymentId?: string | null;
  paymentStatus: ProdamusPaymentStatus;
  planCode?: ProdamusPlanCode;
  premiumActive: boolean;
  premiumExpiresAt?: string | null;
}

const PENDING_ORDER_STORAGE_KEY = 'annword_pending_payment_order_id';

const friendlyPaymentError = (error: unknown): Error => {
  if (error instanceof BackendApiError && error.status === 401) return new Error('Для покупки Premium нужно войти в аккаунт.');
  if (error instanceof BackendApiError && error.status === 503) return new Error(error.message || 'Оплата Premium временно не настроена.');
  if (error instanceof Error) return error;
  return new Error('Не удалось создать платёж. Попробуйте позже.');
};

const rememberPendingOrder = (orderId: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PENDING_ORDER_STORAGE_KEY, orderId);
  } catch {
    // Payment state persistence must not block checkout.
  }
};

const forgetPendingOrder = (orderId?: string | null): void => {
  if (typeof window === 'undefined') return;
  try {
    const current = window.localStorage.getItem(PENDING_ORDER_STORAGE_KEY);
    if (!orderId || current === orderId) window.localStorage.removeItem(PENDING_ORDER_STORAGE_KEY);
  } catch {
    // Ignore localStorage errors.
  }
};

export const readPendingProdamusOrderId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(PENDING_ORDER_STORAGE_KEY);
  } catch {
    return null;
  }
};

export const prodamusPaymentService = {
  createPayment: async (planCode: ProdamusPlanCode): Promise<ProdamusPaymentResponse> => {
    try {
      if (isBackendApiConfigured) {
        const payment = await backendApiRequest<ProdamusPaymentResponse>('/api/payments/prodamus/create', { method: 'POST', body: { planCode } });
        rememberPendingOrder(payment.orderId);
        return payment;
      }

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
      rememberPendingOrder(payload.orderId);
      return payload;
    } catch (error) {
      throw friendlyPaymentError(error);
    }
  },

  getPaymentStatus: async (orderId: string): Promise<ProdamusPaymentStatusResponse> => {
    const normalized = orderId.trim();
    if (!normalized) throw new Error('Не передан номер заказа.');

    try {
      if (isBackendApiConfigured) {
        const status = await backendApiRequest<ProdamusPaymentStatusResponse>(`/api/payments/prodamus/status?order_id=${encodeURIComponent(normalized)}`);
        if (status.premiumActive) forgetPendingOrder(status.orderId);
        return status;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session?.access_token) throw new Error('Для проверки Premium нужно войти в аккаунт.');

      const response = await fetch(`/api/payments/prodamus/status?order_id=${encodeURIComponent(normalized)}`, {
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      const payload = await response.json().catch(() => null) as { error?: string } | ProdamusPaymentStatusResponse | null;
      if (!response.ok) throw new Error(payload && 'error' in payload && payload.error ? payload.error : 'Не удалось проверить оплату.');
      if (!payload || !('paymentStatus' in payload)) throw new Error('Сервер не вернул статус оплаты.');
      if (payload.premiumActive) forgetPendingOrder(payload.orderId);
      return payload;
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 404) return { status: 'not_found', orderId: normalized, paymentStatus: 'not_found', premiumActive: false };
      throw error instanceof Error ? error : new Error('Не удалось проверить оплату.');
    }
  },

  forgetPendingOrder,
};