import path from 'node:path';
import { expect, test } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const webBase = (process.env.WEB_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const apiBase = (process.env.API_URL ?? 'http://localhost:8100').replace(/\/$/, '');

test.describe('browse', { tag: '@e2e' }, () => {
  test('sorting by Price: high to low shows the most expensive plant first', async ({ page }) => {
    test.setTimeout(90_000);

    await page.goto(`${webBase}/`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: /every windowsill/ })).toBeVisible({
      timeout: 60_000,
    });
    const filters = page.locator('[aria-label="Filters"]');
    await expect(filters).toBeVisible();
    const sortBy = filters.getByRole('combobox');
    await expect(sortBy).toBeVisible();
    await expect(page.getByRole('article').first()).toBeVisible({ timeout: 60_000 });
    await sortBy.selectOption({ label: 'Price: high to low' });

    const firstHeading = page.getByRole('article').first().getByRole('heading', { level: 3 });
    await expect(firstHeading).toBeVisible();

    // Oracle: most expensive in the seed catalog — do not use sort=price-desc (see FINDINGS BUG-005).
    const allRes = await page.request.get(`${apiBase}/api/plants?pageSize=48`);
    expect(allRes.ok()).toBeTruthy();
    const all = (await allRes.json()) as { items: { name: string; price: number }[] };
    const priciest = all.items.reduce((best, p) => (p.price > best.price ? p : best));
    await expect(firstHeading).toHaveText(priciest.name);
  });
});
