import { expect, test } from '@playwright/test';
import { BrowsePage } from '../pages/BrowsePage';

test.describe('catalog visuals', () => {
  test('first screen of the plant catalog', { tag: '@visual' }, async ({ page }) => {
    const browse = new BrowsePage(page);
    await browse.open();
    await expect(browse.heroHeading).toBeVisible();
    await expect(browse.filters).toBeVisible();
    await expect(browse.resultsTitle).toHaveText(/\d+ plants/);
    await expect(browse.firstPlantCard).toBeVisible();
    await expect(page).toHaveScreenshot('catalog-first-screen.png');
  });

  test('Monstera Deliciosa card (healthy stock)', { tag: '@visual' }, async ({ page }) => {
    const browse = new BrowsePage(page);
    await browse.open();
    await expect(browse.resultsTitle).toHaveText(/\d+ plants/);

    const card = browse.plantCard('Monstera Deliciosa');
    await expect(card).toBeVisible();
    const image = card.getByRole('img', { name: 'Monstera Deliciosa' });
    await expect(image).toBeVisible();
    await expect(image).toHaveJSProperty('complete', true);
    await expect(image).not.toHaveJSProperty('naturalWidth', 0);

    await expect(card).toHaveScreenshot('monstera-deliciosa-card.png');
  });

  test('Hoya Carnosa card (low stock in seed)', { tag: '@visual' }, async ({ page }) => {
    const browse = new BrowsePage(page);
    await browse.open('', { page: 2 });
    await expect(browse.resultsTitle).toHaveText(/\d+ plants/);

    const card = browse.plantCard('Hoya Carnosa');
    await expect(card).toBeVisible();
    const image = card.getByRole('img', { name: 'Hoya Carnosa' });
    await expect(image).toBeVisible();
    await expect(image).toHaveJSProperty('complete', true);
    await expect(image).not.toHaveJSProperty('naturalWidth', 0);

    await expect(card).toHaveScreenshot('hoya-carnosa-card.png');
  });
});
