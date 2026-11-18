import path from 'node:path';
import { expect, test } from '@playwright/test';
import dotenv from 'dotenv';
import { formatBlockingMessage } from './baseline';
import { scanPage } from './helpers/scan';

dotenv.config({ path: path.join(process.cwd(), '.env') });

test.describe('popular accessibility', { tag: '@a11y' }, () => {
  // PP-09 — axe scan of plant page with Popular right now visible
  test('PP-09: Plant page with Popular right now has no blocking axe findings', async ({
    page,
  }, testInfo) => {
    await page.goto('/plants/pl-monstera', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Monstera Deliciosa' })).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByRole('heading', { name: 'Popular right now' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole('region', { name: 'Popular right now' })).toBeVisible();
    const { blocking } = await scanPage(page, testInfo, { name: 'plant-popular' });
    expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
  });
});
