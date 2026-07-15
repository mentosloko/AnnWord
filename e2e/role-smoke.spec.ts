import { expect, test } from '@playwright/test';

const publicEntries = [
  { path: '/', heading: /Английские слова, которые остаются в памяти/i, cta: /Выбрать формат и начать/i },
  { path: '/practice', heading: /Регулярно повторяйте английские слова/i, cta: /Создать Practice-аккаунт/i },
  { path: '/kids', heading: /Учите слова через игру/i, cta: /Создать Kids-профиль/i },
  { path: '/teacher', heading: /Назначайте ученикам словари/i, cta: /Создать Teacher-аккаунт/i },
];

test.describe('public role entry smoke', () => {
  for (const entry of publicEntries) {
    test(`opens ${entry.path} without an unexpected registration popup`, async ({ page }) => {
      await page.goto(entry.path);
      await expect(page.getByRole('heading', { name: entry.heading }).first()).toBeVisible();
      await expect(page.getByRole('button', { name: entry.cta }).first()).toBeVisible();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    });
  }
});

test('targeted landing opens registration only after the explicit CTA', async ({ page }) => {
  await page.goto('/kids');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: /Создать Kids-профиль/i }).first().click();
  await expect(page.getByRole('dialog')).toContainText(/регистрац|аккаунт|почт/i);
});

test('root landing explains account modes before registration', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Выбрать формат и начать/i }).click();
  const choice = page.getByRole('dialog');
  await expect(choice).toContainText(/Practice/i);
  await expect(choice).toContainText(/Kids/i);
  await expect(choice).toContainText(/Teacher/i);
});
