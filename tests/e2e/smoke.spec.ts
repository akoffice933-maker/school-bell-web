import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear();
    indexedDB.deleteDatabase('school_bell_db');
  });
});

test('smoke flow: renders, navigates, toggles settings', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1, name: 'Главная' })).toBeVisible();
  await expect(page.getByText('Ближайшие звонки')).toBeVisible();

  await page.locator('aside').getByRole('button', { name: 'Расписание' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Расписание' })).toBeVisible();
  await expect(page.getByRole('button', { name: '📅 Расписание звонков' })).toBeVisible();

  await page.locator('aside').getByRole('button', { name: 'Настройки' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Настройки' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '🎨 Оформление' })).toBeVisible();

  await page.getByRole('button', { name: 'Тёмная Вечером' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);

  await page.getByRole('button', { name: 'Служба запущена' }).click();
  await expect(page.getByRole('button', { name: 'Служба остановлена' })).toBeVisible();

  await page.locator('aside').getByRole('button', { name: 'Главная' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Главная' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '📋 Последние события' })).toBeVisible();
});
