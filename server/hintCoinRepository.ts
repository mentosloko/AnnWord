import type { UserProfile } from '../types';
import { transaction } from './db';
import { reconcileProfileMood } from './petMoodRepository';

export type HintCoinAction = 'charge' | 'refund';
export type HintCoinStatus = 'charged' | 'refunded' | 'insufficient' | 'absent';

export interface HintCoinOperationResult {
  status: HintCoinStatus;
  profile: UserProfile;
}

const normalizeOperationId = (value: unknown): string => {
  const operationId = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(operationId)) throw new Error('Некорректный идентификатор операции подсказки.');
  return operationId;
};

export async function applyHintCoinOperation(
  userId: string,
  rawOperationId: unknown,
  action: HintCoinAction,
  rawCost = 1,
): Promise<HintCoinOperationResult> {
  const operationId = normalizeOperationId(rawOperationId);
  const cost = Math.max(1, Math.min(10, Math.round(Number(rawCost) || 1)));

  const status = await transaction(async client => {
    const existing = await client.query<{ status: 'charged' | 'refunded'; cost: number }>(
      `select status, cost
         from hint_coin_operations
        where user_id = $1 and operation_id = $2
        for update`,
      [userId, operationId],
    );
    const row = existing.rows[0];

    if (row) {
      if (action === 'charge') return row.status as HintCoinStatus;
      if (row.status === 'refunded') return 'refunded' as const;
      await client.query(
        `update profiles
            set coins = coins + $2::integer,
                updated_at = now()
          where id = $1`,
        [userId, row.cost],
      );
      await client.query(
        `update hint_coin_operations
            set status = 'refunded', updated_at = now()
          where user_id = $1 and operation_id = $2`,
        [userId, operationId],
      );
      return 'refunded' as const;
    }

    if (action === 'refund') return 'absent' as const;

    const profile = await client.query<{ coins: number }>(
      `select coins from profiles where id = $1 for update`,
      [userId],
    );
    const coins = Math.max(0, Math.round(profile.rows[0]?.coins || 0));
    if (coins < cost) return 'insufficient' as const;

    await client.query(
      `update profiles
          set coins = coins - $2::integer,
              updated_at = now()
        where id = $1`,
      [userId, cost],
    );
    await client.query(
      `insert into hint_coin_operations (user_id, operation_id, cost, status)
       values ($1, $2, $3, 'charged')`,
      [userId, operationId, cost],
    );
    return 'charged' as const;
  });

  return { status, profile: await reconcileProfileMood(userId) };
}
