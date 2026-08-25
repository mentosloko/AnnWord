import { expect, test, type Page, type Route } from '@playwright/test';

const API_ORIGIN = 'http://127.0.0.1:8787';
const APP_ORIGIN = 'http://127.0.0.1:4173';
const USER = { id: 'classic-hint-e2e', email: 'classic-hint@example.ru', name: 'Parent' };
const SESSION_KEY = `annword:game-session:v1:${USER.id}`;

const corsHeaders = {
  'Access-Control-Allow-Origin': APP_ORIGIN,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, X-AnnWord-Session',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};
const fulfillJson = (route: Route, body: unknown, status = 200) => route.fulfill({ status, headers: corsHeaders, body: JSON.stringify(body) });

const installBackend = async (page: Page) => {
  let coins = 5;
  let coinWrites = 0;
  const makeProfile = () => ({
    username: 'Parent',
    role: 'parent',
    accountMode: 'parent',
    subscriptionTier: 'premium',
    premiumExpiresAt: '2099-01-01T00:00:00.000Z',
    featureFlags: { adultRoom: true, premiumDictionaries: true },
    activeWordSource: {
      source: 'premium',
      difficulty: 'ALL',
      premiumDictionaryId: 'kids_animals',
      updatedAt: '2026-08-25T18:00:00.000Z',
    },
    customDictionaryEn: [],
    assignedWords: [],
    dictionaryCollections: [],
    stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {}, wordsToReview: {} },
    pet: {
      name: 'Рэй', type: 'Puppy', level: 2, mood: 'happy', xp: 100,
      equippedAccessories: [], characterOnboarded: true,
    },
    coins,
    inventory: [],
  });

  await page.route(`${API_ORIGIN}/api/**`, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders, body: '' });
      return;
    }
    if (path === '/api/profile/bootstrap') {
      await fulfillJson(route, { user: USER, profile: makeProfile(), quest: null });
      return;
    }
    if (path === '/api/profile/coins') {
      const body = request.postDataJSON() as { amount?: number };
      coins = Math.max(0, coins + Number(body?.amount || 0));
      coinWrites += 1;
      await fulfillJson(route, { profile: makeProfile() });
      return;
    }
    if (path === '/api/daily-quest/today') {
      await fulfillJson(route, { quest: null });
      return;
    }
    if (path.startsWith('/api/profile/')) {
      await fulfillJson(route, { profile: makeProfile() });
      return;
    }
    if (path.startsWith('/api/analytics') || path.startsWith('/api/game-events')) {
      await fulfillJson(route, { ok: true });
      return;
    }
    await fulfillJson(route, { ok: true });
  });

  return {
    getCoins: () => coins,
    getCoinWrites: () => coinWrites,
  };
};

const dismissRules = async (page: Page) => {
  const dialog = page.getByRole('dialog', { name: /Как играть в «Классику»/i });
  const visible = await dialog.waitFor({ state: 'visible', timeout: 2_500 }).then(() => true).catch(() => false);
  if (visible) await dialog.getByRole('button', { name: 'Начать игру' }).click();
};

const readSession = async (page: Page): Promise<any | null> => page.evaluate(key => {
  const raw = window.localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}, SESSION_KEY);

const startClassic = async (page: Page) => {
  await page.getByRole('button', { name: /^Классика/ }).click();
  const start = page.getByRole('button', { name: 'Начать игру' });
  if (await start.isVisible().catch(() => false)) await start.click();
  await dismissRules(page);
  await expect.poll(async () => (await readSession(page))?.gameType).toBe('game');
};

test('Classic hint -> submit -> restart -> reopen keeps a clean playable round', async ({ page }) => {
  const backend = await installBackend(page);
  await page.goto('/kids');
  await startClassic(page);

  await page.getByRole('button', { name: /Подсказка · 1★/ }).click();
  await expect(page.getByRole('dialog', { name: 'Подсказка' })).toContainText('Попробуйте слово:');
  await expect.poll(async () => (await readSession(page))?.state?.gameState?.hintCoinsSpent).toBe(1);
  expect(backend.getCoins()).toBe(4);
  expect(backend.getCoinWrites()).toBe(1);

  await page.getByRole('button', { name: 'Закрыть подсказку' }).click();
  const saved = await readSession(page);
  const secret = saved.state.gameState.secretWord as string;
  expect(secret.length).toBeGreaterThanOrEqual(4);
  expect(secret.length).toBeLessThanOrEqual(6);

  await page.keyboard.type(secret);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Победа!' })).toBeVisible();
  await expect.poll(async () => readSession(page)).toBeNull();

  await page.getByRole('button', { name: 'Играть снова' }).click();
  await dismissRules(page);
  await expect.poll(async () => (await readSession(page))?.gameType).toBe('game');
  const restarted = await readSession(page);
  expect(restarted.state.gameState.hintCoinsSpent).toBe(0);
  expect(restarted.state.gameState.hint).toBeNull();
  expect(restarted.state.gameState.currentGuess).toBe('');

  await page.getByRole('button', { name: 'Назад в меню' }).click();
  await page.getByRole('button', { name: 'Продолжить сохранённую' }).click();
  await dismissRules(page);
  const reopened = await readSession(page);
  expect(reopened.state.gameState.hintCoinsSpent).toBe(0);
  expect(reopened.state.gameState.currentGuess).toBe('');
  await expect(page.getByRole('button', { name: /Подсказка · 1★/ })).toBeEnabled();
});
