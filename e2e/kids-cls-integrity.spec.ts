import { expect, test, type Page, type Route } from '@playwright/test';

const API_ORIGIN = 'http://127.0.0.1:8787';
const APP_ORIGIN = 'http://127.0.0.1:4173';
const USER = { id: 'kids-cls-e2e', email: 'kids-cls@example.ru', name: 'Parent' };

const profile = {
  username: 'Parent',
  role: 'parent',
  accountMode: 'parent',
  subscriptionTier: 'premium',
  premiumExpiresAt: '2099-01-01T00:00:00.000Z',
  featureFlags: { adultRoom: true, premiumDictionaries: true },
  activeWordSource: { source: 'builtin', difficulty: 'ALL', updatedAt: '2026-08-25T20:00:00.000Z' },
  customDictionaryEn: [],
  assignedWords: [],
  dictionaryCollections: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {}, wordsToReview: {} },
  pet: {
    name: 'Рэй', type: 'Puppy', level: 2, mood: 'happy', xp: 100,
    moodScore: 72, equippedAccessories: [], characterOnboarded: true,
  },
  coins: 10,
  inventory: [],
};

const quest = {
  questDate: '2026-08-25',
  kind: 'all_five_games',
  title: 'Большое приключение',
  description: 'За сегодня выполни пять игровых целей: Змейка, Виселица, Память, Анаграммы и Спринт.',
  progressLabel: '0/5: начни с любой игры',
  completedModes: [],
  completed: false,
  completedAt: null,
  rewardItemId: null,
  rewardWorldId: null,
};

const headers = {
  'Access-Control-Allow-Origin': APP_ORIGIN,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, X-AnnWord-Session',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};

const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, headers, body: JSON.stringify(body) });

const installBackend = async (page: Page) => {
  await page.route(`${API_ORIGIN}/api/**`, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers, body: '' });
      return;
    }
    if (path === '/api/profile/bootstrap') {
      await json(route, { user: USER, profile, quest: null });
      return;
    }
    if (path === '/api/daily-quest/today') {
      await new Promise(resolve => setTimeout(resolve, 900));
      await json(route, { quest });
      return;
    }
    if (path === '/api/family/teacher-connections') {
      await json(route, { connections: [] });
      return;
    }
    if (path.startsWith('/api/analytics') || path.startsWith('/api/game-events')) {
      await json(route, { ok: true });
      return;
    }
    if (path.startsWith('/api/profile/')) {
      await json(route, { profile });
      return;
    }
    await json(route, { ok: true });
  });
};

test('mobile Kids remains at CLS <= 0.1 while the daily quest hydrates', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    (window as any).__annwordCls = 0;
    if (typeof PerformanceObserver === 'undefined') return;
    try {
      const observer = new PerformanceObserver(list => {
        for (const entry of list.getEntries() as any[]) {
          if (!entry.hadRecentInput) (window as any).__annwordCls += Number(entry.value || 0);
        }
      });
      observer.observe({ type: 'layout-shift', buffered: true } as PerformanceObserverInit);
      (window as any).__annwordClsObserver = observer;
    } catch {
      // Chromium in CI supports layout-shift; keep a zero fallback for older local browsers.
    }
  });
  await installBackend(page);

  await page.goto('/kids');
  await expect(page.getByRole('heading', { name: 'Поиграем со словами?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Большое приключение' })).toBeVisible();
  await page.waitForTimeout(500);

  const cls = await page.evaluate(() => Number((window as any).__annwordCls || 0));
  expect(cls).toBeLessThanOrEqual(0.1);
});
