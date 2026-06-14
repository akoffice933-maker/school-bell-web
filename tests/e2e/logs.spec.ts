import { expect, test } from '@playwright/test';
import { makeWavFile, resetAppState } from './helpers';

test.beforeEach(async ({ page }) => {
  await resetAppState(page);
});

test('logs: records an upload and supports search/filtering', async ({ page }) => {
  await page.goto('/');
  await page.locator('aside').getByRole('button', { name: 'Библиотека аудио' }).click();

  const audio = makeWavFile({ name: 'journal-tone.wav' });
  await page.getByRole('button', { name: 'Загрузить аудио' }).click();
  await page.locator('input[type="file"]').setInputFiles(audio);
  await expect(page.getByTitle('journal-tone.wav')).toBeVisible();

  await page.locator('aside').getByRole('button', { name: 'Журнал событий' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Журнал событий' })).toBeVisible();

  await page.getByPlaceholder('Поиск по сообщению...').fill('journal-tone.wav');
  await expect(page.getByText('📁 Загружен аудиофайл: journal-tone.wav', { exact: true })).toBeVisible();

  await page.getByRole('combobox').selectOption('system');
  await expect(page.getByText('📁 Загружен аудиофайл: journal-tone.wav', { exact: true })).toBeVisible();
});
