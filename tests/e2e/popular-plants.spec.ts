import path from 'node:path';
import { expect, test } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const webBase = (process.env.WEB_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const apiBase = (process.env.API_URL ?? 'http://localhost:8100').replace(/\/$/, '');

type PopularItem = { id: string; name: string; unitsSold: number; stock: number };

test.describe('popular plants e2e', { tag: '@e2e' }, () => {
  // PP-08 — real API + UI: Popular right now on plant page; current omitted; link navigates
  test('PP-08: plant page shows Popular right now without the current plant', async ({ page }) => {
    test.setTimeout(90_000);

    const reset = await page.request.post(`${apiBase}/api/admin/reset`);
    expect(reset.ok(), await reset.text()).toBeTruthy();

    const popularRes = await page.request.get(`${apiBase}/api/popular?limit=12`);
    expect(popularRes.ok(), await popularRes.text()).toBeTruthy();
    const popular = (await popularRes.json()) as { items: PopularItem[] };
    expect(popular.items.length, 'need popular plants').toBeGreaterThan(0);

    const inStockPopular = popular.items.find((p) => p.stock > 0);
    expect(inStockPopular, 'need an in-stock popular plant').toBeTruthy();
    const plantId = inStockPopular!.id;

    await page.goto(`${webBase}/plants/${plantId}`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'Popular right now' })).toBeVisible({
      timeout: 30_000,
    });

    const section = page.getByRole('region', { name: 'Popular right now' });
    await expect(section).toBeVisible();
    const links = section.getByRole('link');
    const linkCount = await links.count();
    expect(linkCount).toBeGreaterThan(0);
    expect(linkCount).toBeLessThanOrEqual(4);

    for (let i = 0; i < linkCount; i += 1) {
      const link = links.nth(i);
      await expect(link).toBeVisible();
      const href = await link.getAttribute('href');
      expect(href, 'popular link href').toMatch(/^\/plants\/pl-/);
      expect(href).not.toBe(`/plants/${plantId}`);
      await expect(link.locator('xpath=following-sibling::*[contains(., "sold this month")]')).toBeVisible();
    }

    const oosIds = new Set(
      (
        (await (
          await page.request.get(`${apiBase}/api/plants?pageSize=48`)
        ).json()) as { items: { id: string; stock: number }[] }
      ).items
        .filter((p) => p.stock === 0)
        .map((p) => p.id),
    );
    for (let i = 0; i < linkCount; i += 1) {
      const href = await links.nth(i).getAttribute('href');
      const id = href?.replace('/plants/', '') ?? '';
      expect(oosIds.has(id), `${id} should not be out of stock`).toBe(false);
    }

    const firstHref = await links.first().getAttribute('href');
    expect(firstHref).toBeTruthy();
    await links.first().click();
    await expect(page).toHaveURL(new RegExp(`${firstHref!.replace(/\//g, '\\/')}\\/?$`), {
      timeout: 30_000,
    });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 60_000 });
  });
});
