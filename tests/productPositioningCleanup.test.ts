import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getPlan, getPublicPlans } from '../services/premiumPlanCatalog';

const read = (path: string) => readFileSync(path, 'utf8');

describe('parent-first product cleanup', () => {
  it('publishes only Kids plans while preserving legacy plan resolution', () => {
    expect(getPublicPlans().map(plan => plan.code)).toEqual(['kids_month', 'kids_year']);
    expect(getPublicPlans().every(plan => plan.mode === 'kids')).toBe(true);
    expect(getPlan('practice_month')?.mode).toBe('practice');
    expect(getPlan('practice_year')?.mode).toBe('practice');
  });

  it('removes obsolete three-mode marketing artifacts', () => {
    expect(existsSync('components/screens/ModeGatewayScreen.tsx')).toBe(false);
    expect(existsSync('public/assets/onboarding/account-mode-practice-dog.svg')).toBe(false);
  });

  it('keeps public metadata and routing docs aligned with the parent funnel', () => {
    const index = read('index.html');
    const routing = read('docs/ROUTING_UI_DECISION.md');
    const premiumAnalytics = read('docs/PREMIUM_FUNNEL_ANALYTICS.md');

    expect(index).toContain('AnnWord — школьные английские слова играючи');
    expect(index).toContain('помогает ребёнку учить заданные в школе английские слова');
    expect(routing).toContain('`/` is the primary AnnWord landing page for parents');
    expect(routing).toContain('`/practice` is legacy login-only entry');
    expect(routing).toContain('services/productEntry.ts');
    expect(premiumAnalytics).toContain('Публичная воронка Premium относится к Kids/parent-продукту');
  });
});
