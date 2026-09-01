const DEFAULT_COUNTER_ID = 112133624;

type YandexMetrikaMethod = 'reachGoal' | 'params' | 'userParams';
type YandexMetrikaFn = (counterId: number, method: YandexMetrikaMethod, ...args: unknown[]) => void;

declare global {
  interface Window {
    ym?: YandexMetrikaFn;
    __ANNWORD_METRIKA_ID__?: number;
  }
}

export interface YandexAnalyticsEventInput {
  eventName: string;
  gameType?: string | null;
  route?: string | null;
}

const GOAL_BY_EVENT: Readonly<Record<string, string>> = {
  game_started: 'game_started',
  game_finished: 'game_completed',
  hint_used: 'hint_used',
  shop_item_bought: 'shop_item_bought',
  inventory_item_used: 'inventory_item_used',
  character_selected: 'character_selected',
  dictionary_uploaded: 'dictionary_uploaded',
  premium_opened: 'premium_viewed',
  premium_plan_selected: 'premium_plan_selected',
  checkout_created: 'premium_checkout_started',
  checkout_redirected: 'premium_checkout_redirected',
  payment_return_success: 'premium_payment_return_success',
  payment_return_pending: 'premium_payment_return_pending',
  payment_return_failed: 'premium_payment_return_failed',
  premium_activated: 'premium_purchased',
  payment_error: 'premium_payment_error',
};

const counterId = (): number => {
  if (typeof window === 'undefined') return DEFAULT_COUNTER_ID;
  const value = Number(window.__ANNWORD_METRIKA_ID__ || DEFAULT_COUNTER_ID);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_COUNTER_ID;
};

const safeGoalParams = (input: YandexAnalyticsEventInput): Record<string, string> | undefined => {
  const params: Record<string, string> = {};
  if (input.gameType) params.game = input.gameType;
  if (input.route) params.route = input.route;
  return Object.keys(params).length > 0 ? params : undefined;
};

export const trackYandexGoal = (goal: string, params?: Record<string, string | number | boolean>): void => {
  if (typeof window === 'undefined' || typeof window.ym !== 'function' || !goal) return;
  try {
    window.ym(counterId(), 'reachGoal', goal, params);
  } catch {
    // Third-party analytics must never affect the product flow.
  }
};

export const forwardAnalyticsEventToYandex = (input: YandexAnalyticsEventInput): void => {
  const goal = GOAL_BY_EVENT[input.eventName];
  if (!goal) return;
  trackYandexGoal(goal, safeGoalParams(input));
};

export const YANDEX_METRIKA_COUNTER_ID = DEFAULT_COUNTER_ID;
