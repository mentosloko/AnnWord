import { expect, test } from '@playwright/test';

const publicEntries = [
  { path: '/', title: /AnnWord/i, cta: 'Для взрослых' },
  { path: '/practice', title: /Practice|AnnWord/i, cta: 'Войти' },
  { path: '/kids', title: /Kids|AnnWord/i, cta: 'Войти' },
  { path: '/teacher', title: /Teacher|AnnWord/i, cta: 'Войти' },
];

test.describe('public role entry smoke', () => {
  for (const entry of publicEntries) {
    test(`opens ${entry.path}`, async ({ page }) => {
      await page.goto(entry.path);
      await expect(page.locator('body')).toContainText(entry.title);
      await expect(page.getByRole('button', { name: new RegExp(entry.cta, 'i') }).first()).toBeVisible();
    });
  }
});

test('landing can open auth modal without route fallback', async ({ page }) => {
  await page.goto('/kids');
  await page.getByRole('button', { name: /зарегистр/i }).first().click();
  await expect(page.getByRole('dialog')).toContainText(/регистрац|аккаунт|почт/i);
});