import { expect, test, type Page, type Route } from '@playwright/test';

const API_ORIGIN = 'http://127.0.0.1:8787';
const APP_ORIGIN = 'http://127.0.0.1:4173';
const EMPTY_STATS = { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} };

const corsHeaders = {
  'Access-Control-Allow-Origin': APP_ORIGIN,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, X-AnnWord-Session',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const fulfillJson = (route: Route, body: unknown, status = 200) => route.fulfill({
  status,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

const profile = {
  username: 'Parent',
  role: 'parent',
  accountMode: 'parent',
  subscriptionTier: 'premium',
  featureFlags: { adultRoom: true, premiumDictionaries: true },
  activeWordSource: { source: 'builtin', difficulty: 'ALL', updatedAt: '2026-08-26T06:00:00.000Z' },
  customDictionaryEn: [],
  assignedWords: [],
  dictionaryCollections: [],
  stats: EMPTY_STATS,
  pet: {
    name: 'Рэй',
    type: 'Puppy',
    level: 1,
    mood: 'happy',
    xp: 0,
    dailyStreak: 3,
    equippedAccessories: [],
    characterOnboarded: true,
  },
  coins: 12,
  inventory: [],
};

const delayedQuest = {
  questDate: '2026-08-26',
  kind: 'all_five_games',
  title: 'Большое приключение',
  description: 'Сегодня выполни пять игровых целей: Змейку, Виселицу, Память, Анаграммы и Спринт.',
  progressLabel: '0/5: начни с любой игры',
  completedModes: [],
  completed: false,
  completedAt: null,
  rewardItemId: null,
  rewardWorldId: null,
};

const installBackend = async (page: Page) => {
  await page.route(`${API_ORIGIN}/api/**`, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders, body: '' });
      return;
    }
    if (path === '/api/profile/bootstrap') {
      // Deliberately omit `quest`: auth bootstrap must render the Kids shell first,
      // then the normal daily-quest request hydrates the dynamic hero below.
      await fulfillJson(route, { user: { id: 'parent-cls', email: 'parent@example.ru', name: 'Parent' }, profile });
      return;
    }
    if (path === '/api/profile/me') {
      await fulfillJson(route, { profile });
      return;
    }
    if (path === '/api/daily-quest/today') {
      await new Promise(resolve => setTimeout(resolve, 700));
      await fulfillJson(route, { quest: delayedQuest });
      return;
    }
    if (path.startsWith('/api/analytics') || path.startsWith('/api/game-events')) {
      await fulfillJson(route, { ok: true });
      return;
    }
    await fulfillJson(route, { ok: true });
  });
};

test('mobile Kids keeps CLS at or below 0.1 while quest state hydrates', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    let cls = 0;
    new PerformanceObserver(list => {
      for (const entry of list.getEntries() as Array<PerformanceEntry & { value?: number; hadRecentInput?: boolean }>) {
        if (!entry.hadRecentInput) cls += Number(entry.value || 0);
      }
    }).observe({ type: 'layout-shift', buffered: true });
    (window as any).__annwordReadCls = () => cls;
  });
  await installBackend(page);

  const questResponse = page.waitForResponse(response => response.url().includes('/api/daily-quest/today') && response.status() === 200);
  await page.goto('/kids');
  await expect(page.getByRole('heading', { name: 'Поиграем со словами?' })).toBeVisible();
  await questResponse;
  await expect(page.getByRole('heading', { name: 'Большое приключение' })).toBeVisible();
  await page.waitForTimeout(500);

  const cls = await page.evaluate(() => Number((window as any).__annwordReadCls?.() || 0));
  console.log(`KIDS_CLS_REPORT ${JSON.stringify({ viewport: '390x844', cls: Number(cls.toFixed(4)) })}`);
  expect(cls).toBeLessThanOrEqual(0.1);
});
