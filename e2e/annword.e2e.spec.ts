import { expect, test } from '@playwright/test';

const DEFAULT_E2E_BASE_URL = 'https://ann-word-44xjpe5t4-mentosloko-1417s-projects.vercel.app';
const getBaseUrl = (): string => (process.env.E2E_BASE_URL || DEFAULT_E2E_BASE_URL).replace(/\/$/, '');

const goHome = async (page: import('@playwright/test').Page) => {
  await page.goto(`${getBaseUrl()}/`);
  await expect(page.getByText('AnnWord', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Играть$/ })).toBeVisible();
};

const startMode = async (page: import('@playwright/test').Page, modeName: RegExp | string) => {
  await goHome(page);
  const modeCard = page.getByRole('button', { name: modeName }).last();
  await modeCard.click();
  await expect(page.getByRole('heading', { name: /Настройка игры/i })).toBeVisible();
  await page.getByRole('button', { name: /Играть:/i }).click();
};

test.describe('AnnWord manual E2E smoke', () => {
  test('home renders without blocking auth bootstrap screen', async ({ page }) => {
    await goHome(page);
    await expect(page.getByText(/Подключаем твой профиль|Проверяю вход/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Классика/i })).toBeVisible();
  });

  test('Wordle supports hint open and hardware keyboard input without retriggering hint', async ({ page }) => {
    await startMode(page, /Классика/i);
    await expect(page.getByRole('button', { name: /Подсказка/i })).toBeVisible();

    await page.getByRole('button', { name: /Подсказка/i }).click();
    await expect(page.getByText(/Готовлю подсказку|Попробуйте слово|Нет подходящих слов/i)).toBeVisible();
    await page.getByRole('button', { name: '×' }).click();
    await expect(page.getByText(/Готовлю подсказку|Попробуйте слово|Нет подходящих слов/i)).toHaveCount(0);

    await page.keyboard.type('TEST');
    await expect(page.getByText(/Готовлю подсказку/i)).toHaveCount(0);
  });

  test('Sprint answer options are not raw English words', async ({ page }) => {
    await startMode(page, /Спринт/i);
    await expect(page.getByText(/Как переводится\?/i)).toBeVisible();

    const sprintRoot = page.locator('div').filter({ hasText: /Как переводится\?/i }).last();
    const optionTexts = await sprintRoot.locator('button').evaluateAll(buttons =>
      buttons
        .map(button => (button.textContent || '').trim())
        .filter(text => text.length > 0)
        .filter(text => !/Меню|Назад|Играть|Войти|Зарегистрироваться/.test(text))
    );

    expect(optionTexts.some(text => /[А-Яа-яЁё]/.test(text))).toBeTruthy();
    const suspiciousEnglishOptions = optionTexts.filter(text => /^[A-Z]{3,10}$/.test(text));
    expect(suspiciousEnglishOptions).toEqual([]);
  });

  test('Anagram accepts a completed attempt and does not stay on checking forever', async ({ page }) => {
    await startMode(page, /Анаграммы/i);
    await expect(page.getByText(/Перевод/i)).toBeVisible();

    const letterButtons = page.locator('button').filter({ hasText: /^[A-Z]$/ });
    const count = await letterButtons.count();
    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i += 1) {
      await letterButtons.nth(0).click();
    }

    await page.getByRole('button', { name: /Проверить/i }).click();
    await expect(page.getByText(/Проверяем слово/i)).toBeVisible();
    await expect(page.getByText(/Проверяем слово/i)).toHaveCount(0, { timeout: 2500 });
  });

  test('Wordle grid remains visible on tablet viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium-desktop', 'tablet viewport smoke runs once from desktop chromium');
    await page.setViewportSize({ width: 1180, height: 820 });
    await startMode(page, /Классика/i);
    await expect(page.getByRole('button', { name: /Подсказка/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ENTER' })).toBeVisible();
    await expect(page.locator('.font-mono').first()).toBeVisible();
  });
});
