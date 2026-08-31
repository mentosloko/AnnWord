import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Premium renewal checkout', () => {
  it('keeps payment plans available when Premium is already active', () => {
    const screen = read('components/screens/PremiumScreen.tsx');
    expect(screen).toContain('Продлить Premium');
    expect(screen).toContain('Новый оплаченный период добавится к уже действующему сроку');
    expect(screen).toContain('{PAYMENTS_ENABLED && <div className="rounded-3xl');
    expect(screen).toContain('paymentPlanButtons');
  });

  it('extends an existing Premium term instead of replacing it', () => {
    const schema = read('db/yandex/001_core_schema.sql');
    expect(schema).toContain('v_base_expires := greatest(coalesce(v_profile.premium_expires_at, now()), now());');
    expect(schema).toContain('v_next_expires := v_base_expires + make_interval(days => v_payment.period_days);');
  });
});
