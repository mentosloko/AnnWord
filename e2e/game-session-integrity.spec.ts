import { expect, test, type Page, type Route } from '@playwright/test';

const API_ORIGIN = 'http://127.0.0.1:8787';
const APP_ORIGIN = 'http://127.0.0.1:4173';
const USER = { id: 'parent-session-e2e', email: 'parent-session@example.ru', name: 'Parent' };
const SESSION_KEY = `annword:game-session:v1:${USER.id}`;

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
    updatedAt: '2026-08-25T15:00:00.000Z',
  },
  customDictionaryEn: [],
  assignedWords: [],
  dictionaryCollections: [],
  stats: { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {}, wordsToReview: {} },
  pet: {
    name: 'Рэй', type: 'Puppy', level: 1, mood: 'happy', xp: 0,
    equippedAccessories: [], characterOnboarded: true,
  },
  coins: 20,
  inventory: [],
});

const corsHeaders = {
  'Access-Control-Allow-Origin': APP_ORIGIN,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, X-AnnWord-Session',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};
const fulfillJson = (route: Route, body: unknown, status = 200) => route.fulfill({ status, headers: corsHeaders, body: JSON.stringify(body) });

const installBackend = async (page: Page) => {
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
};

const dismissRules = async (page: Page, title: string) => {
  const dialog = page.getByRole('dialog', { name: new RegExp(`Как играть в «${title}»`, 'i') });
  const visible = await dialog.waitFor({ state: 'visible', timeout: 2_500 }).then(() => true).catch(() => false);
  if (visible) await dialog.getByRole('button', { name: 'Начать игру' }).click();
};

const startMode = async (page: Page, buttonName: RegExp, rulesTitle: string) => {
  await page.getByRole('button', { name: buttonName }).click();
  const start = page.getByRole('button', { name: 'Начать игру' });
  if (await start.isVisible().catch(() => false)) await start.click();
  await dismissRules(page, rulesTitle);
};

const readSession = async (page: Page): Promise<any | null> => page.evaluate(key => {
  const raw = window.localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}, SESSION_KEY);

const waitForSavedType = async (page: Page, gameType: string) => expect.poll(async () => (await readSession(page))?.gameType).toBe(gameType);

const goHomeFromMode = async (page: Page) => {
  await page.getByRole('button', { name: 'Назад' }).first().click();
  await expect(page.getByRole('heading', { name: /Поиграем со словами|Серия:/i })).toBeVisible();
};

test.describe('unified resumable game sessions', () => {
  test('1 из 2 resumes exact progress and restart clears the previous round', async ({ page }) => {
    await installBackend(page);
    await page.goto('/kids');
    await startMode(page, /^1 из 2/, '1 из 2');
    await waitForSavedType(page, 'translation');

    const first = await readSession(page);
    const correct = first.state.question.correct as string;
    await page.getByRole('button', { name: correct, exact: true }).click();
    await expect(page.getByText('1/10 · ⭐ 1')).toBeVisible();
    await expect.poll(async () => (await readSession(page))?.state?.answered).toBe(1);

    await goHomeFromMode(page);
    await page.getByRole('button', { name: 'Продолжить сохранённую' }).click();
    await dismissRules(page, '1 из 2');
    await expect(page.getByText('1/10 · ⭐ 1')).toBeVisible();
    expect((await readSession(page)).state.feedback).toBe('correct');

    await page.getByRole('button', { name: 'Продолжить' }).click();
    for (let answered = 1; answered < 10; answered += 1) {
      await expect.poll(async () => (await readSession(page))?.state?.answered).toBe(answered);
      const saved = await readSession(page);
      const answer = saved.state.question.correct as string;
      await page.getByRole('button', { name: answer, exact: true }).click();
      await expect(page.getByText(`${answered + 1}/10 · ⭐ ${answered + 1}`)).toBeVisible();
      if (answered + 1 < 10) await page.getByRole('button', { name: 'Продолжить' }).click();
    }
    await page.getByRole('button', { name: 'Завершить раунд' }).click();
    await expect(page.getByRole('dialog', { name: 'Раунд завершён' })).toBeVisible();
    await expect.poll(async () => readSession(page)).toBeNull();

    await page.getByRole('button', { name: 'Играть снова' }).click();
    await waitForSavedType(page, 'translation');
    const restarted = await readSession(page);
    expect(restarted.state.answered).toBe(0);
    expect(restarted.score.correct).toBe(0);
  });

  test('Memory keeps moves and board when returning directly', async ({ page }) => {
    await installBackend(page);
    await page.goto('/kids');
    await startMode(page, /^Память/, 'Память');
    await waitForSavedType(page, 'memory');

    const closedCards = page.getByRole('button', { name: /Закрытая карточка\. Открыть/ });
    await closedCards.nth(0).click();
    await closedCards.nth(0).click();
    await expect(page.getByText('Ходов: 1')).toBeVisible();
    await expect.poll(async () => (await readSession(page))?.state?.moves).toBe(1);
    const before = await readSession(page);

    await goHomeFromMode(page);
    await page.getByRole('button', { name: /^Память/ }).click();
    await dismissRules(page, 'Память');
    await expect(page.getByText('Ходов: 1')).toBeVisible();
    const after = await readSession(page);
    expect(after.state.moves).toBe(1);
    expect(after.state.cards).toEqual(before.state.cards);
  });

  test('Snake keeps partial path and Continue opens the latest saved game', async ({ page }) => {
    await installBackend(page);
    await page.goto('/kids');
    await startMode(page, /^Змейка/, 'Змейка');
    await waitForSavedType(page, 'letter_square');

    const firstLetter = page.getByRole('button', { name: /^Буква / }).first();
    await firstLetter.click();
    await expect.poll(async () => (await readSession(page))?.state?.selected?.length).toBe(1);

    await goHomeFromMode(page);
    await page.getByRole('button', { name: 'Продолжить сохранённую' }).click();
    await dismissRules(page, 'Змейка');
    await expect(page.getByRole('button', { name: /позиция 1/ })).toHaveCount(1);
    expect((await readSession(page)).gameType).toBe('letter_square');
  });

  test('corrupted or incompatible save is removed and does not create a broken Continue state', async ({ page }) => {
    await installBackend(page);
    await page.addInitScript(({ key }) => {
      window.localStorage.setItem(key, JSON.stringify({ schemaVersion: 99, gameType: 'memory', dictionaryId: 'broken', state: {}, score: 1, rewardState: 'active', updatedAt: new Date().toISOString(), dictionaryWords: ['PANDA'] }));
    }, { key: SESSION_KEY });
    await page.goto('/kids');
    await expect(page.getByRole('button', { name: 'Продолжить сохранённую' })).toHaveCount(0);
    await expect.poll(async () => page.evaluate(key => window.localStorage.getItem(key), SESSION_KEY)).toBeNull();
  });
});
