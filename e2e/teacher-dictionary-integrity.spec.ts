import { expect, test, type Page, type Route } from '@playwright/test';

const API_ORIGIN = 'http://127.0.0.1:8787';
const APP_ORIGIN = 'http://127.0.0.1:4173';
const TEACHER = { id: 'teacher-e2e', email: 'teacher@example.ru', name: 'Teacher' };
const CHILD = { id: 'child-e2e', email: 'child@example.ru', name: 'Child' };
const WORDS = ['PANDA', 'TIGER', 'ZEBRA'];
const TRANSLATIONS = { PANDA: 'панда', TIGER: 'тигр', ZEBRA: 'зебра' };

const emptyStats = { gamesPlayed: 0, gamesWon: 0, wordsGuessed: {}, wordsToReview: {}, wordPerformance: {}, wordLearningHistory: {} };
const pet = {
  name: 'Рэй', type: 'Puppy', level: 1, mood: 'happy', xp: 0, moodScore: 70,
  equippedAccessories: [], characterOnboarded: true,
};

const corsHeaders = {
  'Access-Control-Allow-Origin': APP_ORIGIN,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'Content-Type, X-AnnWord-Session',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  'Content-Type': 'application/json',
};
const fulfillJson = (route: Route, body: unknown, status = 200) => route.fulfill({ status, headers: corsHeaders, body: JSON.stringify(body) });

const installTeacherAssignmentBackend = async (page: Page) => {
  let actor: 'teacher' | 'child' | 'signed-out' = 'signed-out';
  let collection: Record<string, unknown> | null = null;
  let assigned = false;
  let savedRequest: any = null;

  const teacherProfile = () => ({
    username: 'Teacher', role: 'teacher', accountMode: 'teacher', subscriptionTier: 'free',
    featureFlags: { adultRoom: true }, activeWordSource: { source: 'builtin', difficulty: 'ALL' },
    customDictionaryEn: [], assignedWords: [], dictionaryCollections: collection ? [collection] : [],
    stats: emptyStats, pet, coins: 0, inventory: [],
  });
  const childProfile = () => ({
    username: 'Child', role: 'parent', accountMode: 'parent', subscriptionTier: 'premium', premiumExpiresAt: '2099-01-01T00:00:00.000Z',
    featureFlags: { adultRoom: true, premiumDictionaries: true }, activeWordSource: { source: 'builtin', difficulty: 'ALL', updatedAt: '2026-08-25T12:00:00.000Z' },
    customDictionaryEn: assigned ? WORDS : [], assignedWords: assigned ? WORDS : [], assignedWordTranslations: assigned ? TRANSLATIONS : {}, dictionaryCollections: [],
    stats: emptyStats, pet, coins: 10, inventory: [],
  });
  const currentUser = () => actor === 'teacher' ? TEACHER : actor === 'child' ? CHILD : null;
  const currentProfile = () => actor === 'teacher' ? teacherProfile() : actor === 'child' ? childProfile() : null;

  await page.route(`${API_ORIGIN}/api/**`, async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: corsHeaders, body: '' });
      return;
    }
    if (path === '/api/profile/bootstrap') {
      const user = currentUser();
      if (!user) { await fulfillJson(route, { code: 'unauthorized', error: 'Unauthorized' }, 401); return; }
      await fulfillJson(route, { user, profile: currentProfile(), quest: null });
      return;
    }
    if (path === '/api/profile/me') {
      if (!currentUser()) { await fulfillJson(route, { code: 'unauthorized', error: 'Unauthorized' }, 401); return; }
      await fulfillJson(route, { profile: currentProfile() });
      return;
    }
    if (path === '/api/profile/dictionary-collections' && request.method() === 'GET') {
      await fulfillJson(route, { collections: collection ? [collection] : [] });
      return;
    }
    if (path === '/api/profile/dictionary-collections' && request.method() === 'POST') {
      savedRequest = request.postDataJSON();
      collection = {
        id: 'teacher-animals',
        title: savedRequest.title,
        source: savedRequest.source || 'manual',
        words: savedRequest.words,
        wordTranslations: savedRequest.wordTranslations,
        createdAt: '2026-08-25T12:00:00.000Z',
      };
      await fulfillJson(route, { collection, profile: teacherProfile() }, 201);
      return;
    }
    if (path === '/api/mentor/learners') {
      await fulfillJson(route, {
        learners: [{ id: CHILD.id, name: 'Child', stats: emptyStats, assignedWords: assigned ? WORDS : [], weeklyAccuracy: 0 }],
        backendReady: true,
      });
      return;
    }
    if (path === '/api/mentor/assign' && request.method() === 'POST') {
      const body = request.postDataJSON() as { learnerId?: string; collectionId?: string };
      if (body.learnerId !== CHILD.id || body.collectionId !== 'teacher-animals') {
        await fulfillJson(route, { error: 'Bad assignment request' }, 400);
        return;
      }
      assigned = true;
      await fulfillJson(route, { ok: true, readyWords: 3 });
      return;
    }
    if (path === '/api/auth/logout' && request.method() === 'POST') {
      actor = 'signed-out';
      await fulfillJson(route, { ok: true });
      return;
    }
    if (path === '/api/auth/email/session' && request.method() === 'POST') {
      const body = request.postDataJSON() as { email?: string };
      actor = body.email === CHILD.email ? 'child' : 'teacher';
      const user = currentUser()!;
      await fulfillJson(route, { access_token: `${actor}-token`, token_type: 'bearer', expires_in: 3600, user, profile: currentProfile(), quest: null });
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
    isAssigned: () => assigned,
    savedRequest: () => savedRequest,
  };
};

const loginAs = async (page: Page, email: string) => {
  await page.getByRole('button', { name: 'Войти' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Войти в AnnWord' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Электронная почта').fill(email);
  await dialog.getByLabel('Пароль').fill('password123');
  await dialog.getByRole('button', { name: 'Войти', exact: true }).click();
  await expect(dialog).toBeHidden();
};

const dismissRulesIfVisible = async (page: Page) => {
  const start = page.getByRole('button', { name: 'Начать игру' });
  if (await start.isVisible().catch(() => false)) await start.click();
};

test('teacher PANDA/TIGER/ZEBRA assignment is playable in child 1-of-2 and Anagrams', async ({ page }) => {
  const backend = await installTeacherAssignmentBackend(page);

  await page.goto('/teacher');
  await loginAs(page, TEACHER.email);
  await expect(page.getByRole('heading', { name: 'Обзор преподавателя' })).toBeVisible();
  await page.getByRole('button', { name: /Словари.*Открыть словари/ }).click();
  await expect(page.getByRole('heading', { name: 'Словарь преподавателя' })).toBeVisible();

  await page.getByLabel('Название словаря').fill('UAT Animals');
  await page.locator('textarea').fill(WORDS.join('\n'));
  await expect(page.getByText('Готовы: 3')).toBeVisible();
  await expect(page.getByText('Нужен перевод: 0')).toBeVisible();
  await page.getByRole('button', { name: 'Сохранить словарь преподавателя' }).click();
  await expect(page.getByText('Словарь «UAT Animals» сохранён.')).toBeVisible();
  expect(backend.savedRequest()?.wordTranslations).toEqual(TRANSLATIONS);

  // 1.2 validates dictionary validity/assignment, not the separate back-navigation contract (tracked in 1.5).
  await page.goto('/workspace');
  await expect(page.getByRole('heading', { name: 'Ученики преподавателя' })).toBeVisible();
  await page.locator('select').selectOption({ label: 'UAT Animals' });
  await page.getByRole('button', { name: 'Назначить', exact: true }).click();
  await expect(page.getByText('Словарь назначен ученику.')).toBeVisible();
  expect(backend.isAssigned()).toBe(true);

  await page.getByRole('button', { name: /Открыть меню аккаунта Teacher/ }).click();
  await page.getByRole('menuitem', { name: 'Выйти' }).click();
  await loginAs(page, CHILD.email);
  await expect(page.getByRole('heading', { name: /Поиграем со словами|Серия:/i })).toBeVisible();

  await page.getByRole('button', { name: /^1 из 2/ }).click();
  await dismissRulesIfVisible(page);
  await expect(page.getByRole('heading', { name: '1 из 2' })).toBeVisible();
  await expect(page.getByText('Нет доступных слов')).toHaveCount(0);
  await expect(page.getByText(/^(панда|тигр|зебра)$/)).toBeVisible();
  await page.getByRole('button', { name: 'Назад' }).first().click();

  await page.getByRole('button', { name: /^Анаграммы/ }).click();
  await dismissRulesIfVisible(page);
  await expect(page.getByRole('heading', { name: 'Анаграммы' })).toBeVisible();
  await expect(page.getByText('Нет доступных слов')).toHaveCount(0);
  await expect(page.getByText('На это слово — 2 попытки')).toBeVisible();
});
