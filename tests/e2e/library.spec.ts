import { expect, test } from '@playwright/test';
import { makeWavFile, resetAppState } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetAppState(page);
});

test('library: uploads an audio file and shows it in the list', async ({ page }) => {
  await page.goto('/');
  await page.locator('aside').getByRole('button', { name: 'Библиотека аудио' }).click();

  await expect(page.getByRole('heading', { level: 1, name: 'Библиотека аудио' })).toBeVisible();

  const audio = makeWavFile({ name: 'e2e-tone.wav' });
  await page.getByRole('button', { name: 'Загрузить аудио' }).click();
  await page.locator('input[type="file"]').setInputFiles(audio);

  await expect(page.getByTitle('e2e-tone.wav')).toBeVisible();
  await expect(page.locator('.card').filter({ hasText: 'e2e-tone.wav' }).getByText('Загружен')).toBeVisible();
});
