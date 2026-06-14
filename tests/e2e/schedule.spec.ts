import { expect, test } from '@playwright/test';
import { resetAppState } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetAppState(page);
});

test('schedule: creates a new event from the modal', async ({ page }) => {
  await page.goto('/');
  await page.locator('aside').getByRole('button', { name: 'Расписание' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Расписание' })).toBeVisible();
  await page.getByRole('button', { name: 'Добавить звонок' }).click();

  await expect(page.getByRole('heading', { level: 3, name: /Новое событие/ })).toBeVisible();

  const modal = page.getByRole('heading', { level: 3, name: /Новое событие/ })
    .locator('xpath=ancestor::div[contains(@class,"card")][1]');

  await modal.locator('input[type="time"]').first().fill('07:07');

  await page.getByRole('button', { name: 'Сохранить' }).click();

  const dayName = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'][new Date().getDay()];
  await expect(page.getByRole('heading', { level: 3, name: dayName })).toBeVisible();
  await expect(page.getByText('07:07')).toBeVisible();
  await expect(page.getByText('Начало урока')).toBeVisible();
});
