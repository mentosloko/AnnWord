import { expect, test, type Page, type Route } from '@playwright/test';

type ActiveWordSource = {
  source: 'builtin' | 'custom' | 'premium';
  difficulty: 'ALL' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  premiumDictionaryId?: string;
  spotlightGrade?: number;
  spotlightSectionId?: string;
  updatedAt?: string;
};

type MockProfile = ReturnType<typeof makeProfile>;

const API_ORIGIN = 'http://127.0.0.1:8787';
const APP_ORIGIN = 'http://127.0.0.1:4173';
const USER = { id: 'parent-e2e', email: 'parent@example.ru', name: 'Parent' };
const EMPTY_STATS = { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {} };

const makeProfile = (activeWordSource: ActiveWordSource, overrides: Record<string, unknown> = {}) => ({
  username: 'Parent',
  role: 'parent',
  accountMode: 'parent',
  subscriptionTier: 'premium',
  premiumExpiresAt: '2099-01-01T00:00:00.000Z',
  featureFlags: { adultRoom: true, premiumDictionaries: true },
  activeWordSource,
  customDictionaryEn: ['PANDA', 'TIGER', 'ZEBRA'],
  assignedWords: [],
  dictionaryCollections: [],
  stats: EMPTY_STATS,
  pet: {
    name: 'Рэй',
    type: 'Puppy',
    level: 1,
    mood: 'happy',
    xp: 0,
    equippedAccessories: [],
    characterOnboarded: true,
  },
  coins: 10,
  inventory: [],
  ...overrides,
});

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

const installBackend = async (page: Page, initialSource: ActiveWordSource) => {
  let signedIn = true;
  let source: ActiveWordSource = { ...initialSource };
  let sourcePatchCount = 0;
  let coins = 10;

  const currentProfile = (): MockProfile => makeProfile(source, { coins });
  const learner = () => ({ id: 'child-e2e', name: 'Child', stats: EMPTY_STATS, assignedWords: [] });

  await page.route(`${API_ORIGIN}/api/**`, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders, body: '' });
      return;
    }

    if (path === '/api/profile/bootstrap') {
      if (!signedIn) {
        await fulfillJson(route, { code: 'unauthorized', error: 'Unauthorized' }, 401);
        return;
      }
      await fulfillJson(route, { user: USER, profile: currentProfile(), quest: null });
      return;
    }

    if (path === '/api/profile/me') {
      await fulfillJson(route, { profile: currentProfile() });
      return;
    }

    if (path === '/api/profile/active-word-source' && request.method() === 'PATCH') {
      const payload = request.postDataJSON() as { activeWordSource?: ActiveWordSource };
      sourcePatchCount += 1;
      source = {
        ...(payload.activeWordSource || { source: 'builtin', difficulty: 'ALL' }),
        updatedAt: new Date(Date.now() + sourcePatchCount * 1000).toISOString(),
      };
      await fulfillJson(route, { profile: currentProfile() });
      return;
    }

    if (path === '/api/profile/coins' && request.method() === 'POST') {
      const payload = request.postDataJSON() as { amount?: number };
      coins = Math.max(0, coins + Number(payload.amount || 0));
      await fulfillJson(route, { profile: currentProfile() });
      return;
    }

    if (path === '/api/family/adult-room' && request.method() === 'POST') {
      await fulfillJson(route, { ok: true, learners: [learner()], backendReady: true });
      return;
    }

    if (path === '/api/mentor/learners') {
      await fulfillJson(route, { learners: [learner()], backendReady: true });
      return;
    }

    if (path === '/api/family/teacher-connections') {
      await fulfillJson(route, { connections: [] });
      return;
    }

    if (path === '/api/auth/logout' && request.method() === 'POST') {
      signedIn = false;
      await fulfillJson(route, { ok: true });
      return;
    }

    if (path === '/api/auth/email/session' && request.method() === 'POST') {
      signedIn = true;
      await fulfillJson(route, {
        access_token: 'e2e-access-token',
        token_type: 'bearer',
        expires_in: 3600,
        user: USER,
        profile: currentProfile(),
        quest: null,
      });
      return;
    }

    if (path === '/api/daily-quest/today') {
      await fulfillJson(route, { quest: null });
      return;
    }

    if (path.startsWith('/api/analytics') || path.startsWith('/api/game-events')) {
      await fulfillJson(route, { ok: true });
      return;
    }

    await fulfillJson(route, { ok: true });
  });

  return {
    profile: currentProfile,
    activeSource: () => source,
    sourcePatchCount: () => sourcePatchCount,
    coins: () => coins,
  };
};

const openDictionarySelection = async (page: Page, currentLabel: string) => {
  const trigger = page.getByRole('button', { name: new RegExp(`Выбрать слова для игр\\. Сейчас: ${currentLabel}`, 'i') });
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(page.getByRole('heading', { name: 'Выбор словаря' })).toBeVisible();
};

const loginAgain = async (page: Page) => {
  await page.getByRole('button', { name: 'Войти' }).click();
  const dialog = page.getByRole('dialog', { name: 'Войти в AnnWord' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Электронная почта').fill(USER.email);
  await dialog.getByLabel('Пароль').fill('password123');
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Поиграем со словами|Серия:/i })).toBeVisible();
};

const dismissFirstLaunchRules = async (page: Page, title: string) => {
  const dialog = page.getByRole('dialog', { name: new RegExp(`Как играть в «${title}»`, 'i') });
  const visible = await dialog.waitFor({ state: 'visible', timeout: 2_000 }).then(() => true).catch(() => false);
  if (visible) await dialog.getByRole('button', { name: 'Начать игру' }).click();
};

test.describe('dictionary integrity browser E2E', () => {
  test('Animals survives save, viewer uses only active theme, logout/login keeps source', async ({ page }) => {
    const backend = await installBackend(page, {
      source: 'builtin',
      difficulty: 'ALL',
      updatedAt: '2026-08-25T10:00:00.000Z',
    });

    await page.goto('/kids');
    await openDictionarySelection(page, 'Детский словарь');

    await page.getByRole('button', { name: /Тематический/ }).click();
    await page.getByRole('button', { name: /Животные/ }).click();
    await expect(page.getByText('Изменения ещё не влияют на игры.')).toBeVisible();
    await page.getByRole('button', { name: 'Готово' }).click();

    await expect(page.getByText('Слова для игр: Животные')).toBeVisible();
    expect(backend.activeSource()).toMatchObject({ source: 'premium', premiumDictionaryId: 'kids_animals' });

    await page.getByRole('button', { name: 'Твой прогресс' }).click();
    await expect(page.getByText('Сейчас используется')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Животные' })).toBeVisible();
    await page.getByRole('button', { name: '← На главную' }).click();

    await page.getByRole('button', { name: /^Анаграммы/ }).click();
    const startGameButton = page.getByRole('button', { name: 'Начать игру' });
    if (await startGameButton.isVisible().catch(() => false)) await startGameButton.click();
    await dismissFirstLaunchRules(page, 'Анаграммы');

    const peekButton = page.getByRole('button', { name: /Открыть словарь: Животные/ });
    await expect(peekButton).toBeVisible();
    await peekButton.click();
    const viewer = page.getByRole('dialog', { name: 'Животные' });
    await expect(viewer).toBeVisible();
    await expect(viewer.getByText('TIGER', { exact: true })).toBeVisible();
    await expect(viewer.getByText('ZEBRA', { exact: true })).toBeVisible();
    await expect(viewer.getByText('APPLE', { exact: true })).toHaveCount(0);
    await expect(viewer.getByText('SCHOOL', { exact: true })).toHaveCount(0);
    expect(backend.coins()).toBe(9);
    await viewer.getByRole('button', { name: 'Закрыть словарь' }).click();
    await page.getByRole('button', { name: 'Назад' }).first().click();

    await page.getByRole('button', { name: /Открыть меню аккаунта Parent/ }).click();
    await page.getByRole('menuitem', { name: 'Выйти' }).click();
    await expect(page.getByRole('button', { name: 'Войти' })).toBeVisible();

    await loginAgain(page);
    await expect(page.getByText('Слова для игр: Животные')).toBeVisible();

    await openDictionarySelection(page, 'Животные');
    await expect(page.getByText('Выбрано сейчас')).toBeVisible();
    await expect(page.getByText('Животные', { exact: true }).first()).toBeVisible();
  });

  test('Custom remains a local draft through stale hydration and back discards it', async ({ page }) => {
    const backend = await installBackend(page, {
      source: 'premium',
      difficulty: 'ALL',
      premiumDictionaryId: 'kids_animals',
      updatedAt: '2026-08-25T10:05:00.000Z',
    });

    await page.goto('/kids');
    await openDictionarySelection(page, 'Животные');

    const patchesBeforeDraft = backend.sourcePatchCount();
    await page.getByRole('button', { name: /Свой/ }).click();
    await expect(page.getByText('Изменения ещё не влияют на игры.')).toBeVisible();
    await expect(page.getByText('Ваш список').first()).toBeVisible();

    const staleProfile = makeProfile({
      source: 'premium',
      difficulty: 'ALL',
      premiumDictionaryId: 'spotlight_school',
      spotlightGrade: 3,
      spotlightSectionId: 'all',
      updatedAt: '2026-08-25T10:01:00.000Z',
    }, { coins: 17 });

    await page.evaluate(({ userId, profile }) => {
      window.dispatchEvent(new CustomEvent('annword:profile-updated', { detail: { userId, profile } }));
    }, { userId: USER.id, profile: staleProfile });

    await expect(page.getByText('Изменения ещё не влияют на игры.')).toBeVisible();
    await expect(page.getByText('Ваш список').first()).toBeVisible();
    expect(backend.sourcePatchCount()).toBe(patchesBeforeDraft);
    expect(backend.activeSource()).toMatchObject({ source: 'premium', premiumDictionaryId: 'kids_animals' });

    await page.getByRole('button', { name: 'Назад без сохранения' }).click();
    await expect(page.getByText('Слова для игр: Животные')).toBeVisible();

    await openDictionarySelection(page, 'Животные');
    await expect(page.getByText('Выбрано сейчас')).toBeVisible();
    await expect(page.getByText('Изменения ещё не влияют на игры.')).toHaveCount(0);
  });

  test('parent workspace -> dictionary -> Back returns to parent workspace', async ({ page }) => {
    await installBackend(page, {
      source: 'premium',
      difficulty: 'ALL',
      premiumDictionaryId: 'kids_animals',
      updatedAt: '2026-08-25T10:10:00.000Z',
    });

    await page.goto('/kids');
    await page.getByRole('button', { name: /Для родителя|Кабинет родителя/ }).click();
    await expect(page.getByRole('heading', { name: 'Кабинет родителя' })).toBeVisible();
    await page.getByLabel('PIN родителя').fill('1234');
    await page.getByRole('button', { name: 'Открыть кабинет' }).click();
    await expect(page.getByRole('button', { name: 'Слова ребёнка' })).toBeVisible();
    await expect(page).toHaveURL(/\/workspace$/);

    await page.getByRole('button', { name: 'Слова ребёнка' }).click();
    await expect(page.getByRole('heading', { name: 'Выбор словаря' })).toBeVisible();
    await expect(page).toHaveURL(/\/dictionary$/);

    await page.getByRole('button', { name: 'Назад без сохранения' }).click();
    await expect(page.getByRole('heading', { name: 'Кабинет родителя' })).toBeVisible();
    await expect(page).toHaveURL(/\/workspace$/);
  });
});
