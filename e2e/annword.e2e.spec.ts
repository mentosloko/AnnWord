import { expect, test } from '@playwright/test';

const goHome = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Учите английские слова через игру/i })).toBeVisible();
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
    await expect(page.getByRole('button', { name: /^Играть$/ })).toBeVisible();
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

    const optionButtons = page.locator('button').filter({ hasText: /[А-Яа-яЁё]/ });
    await expect(optionButtons.first()).toBeVisible();

    const visibleOptions = await page.locator('button').evaluateAll(buttons =>
      buttons
        .map(button => (button.textContent || '').trim())
        .filter(text => text.length > 0)
        .filter(text => !/Меню|Назад|Играть|Войти|Зарегистрироваться/.test(text))
    );

    const suspiciousEnglishOptions = visibleOptions.filter(text => /^[A-Z]{3,10}$/.test(text));
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

  test('Wordle grid remains visible on tablet viewport', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'single viewport smoke is enough for manual layout guard');
    await page.setViewportSize({ width: 1180, height: 820 });
    await startMode(page, /Классика/i);
    await expect(page.getByRole('button', { name: /Подсказка/i })).toBeVisible();
    await expect(page.getByRole('button', { name: 'ENTER' })).toBeVisible();
    await expect(page.locator('.font-mono').first()).toBeVisible();
  });
});
