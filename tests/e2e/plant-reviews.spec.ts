import path from 'node:path';
import { expect, test } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const webBase = (process.env.WEB_URL ?? 'http://localhost:5173').replace(/\/$/, '');
const apiBase = (process.env.API_URL ?? 'http://localhost:8100').replace(/\/$/, '');
const avaEmail = process.env.FERNLY_USER_EMAIL ?? 'ava@fernly.test';
const avaPassword = process.env.FERNLY_USER_PASSWORD ?? 'Fernly-Ava-2026';

test.describe('plant reviews e2e', { tag: '@e2e' }, () => {
  test.beforeEach(async ({ request }) => {
    const res = await request.post(`${apiBase}/api/admin/reset`);
    if (!res.ok()) {
      throw new Error(`reset failed: ${res.status()} ${await res.text()}`);
    }
  });

  // PR-11
  test('seeded plant shows Reviews heading, count, and newest-first seed reviews', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`${webBase}/plants/pl-snake`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Snake Plant' })).toBeVisible({ timeout: 60_000 });

    const section = page.locator('section[aria-labelledby="reviews-title"]');
    await expect(page.getByRole('heading', { level: 2, name: 'Reviews' })).toBeVisible();
    await expect(section.getByText(/3 reviews/)).toBeVisible();
    await expect(section.getByText('Ben Moss')).toBeVisible();
    await expect(section.getByText('Omar K.')).toBeVisible();
    await expect(section.getByText('Grace L.')).toBeVisible();

    // Newest first: Ben (2026-10-05) before Omar (2026-09-18) before Grace (2026-09-02)
    const items = section.locator('li');
    await expect(items.nth(0)).toContainText('Ben Moss');
    await expect(items.nth(1)).toContainText('Omar K.');
    await expect(items.nth(2)).toContainText('Grace L.');
  });

  test('seeded plant average shows 4.7 for ratings 5, 4, and 5', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`${webBase}/plants/pl-snake`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 2, name: 'Reviews' })).toBeVisible({ timeout: 60_000 });
    const section = page.locator('section[aria-labelledby="reviews-title"]');
    // 5+4+5 → 4.7 per feature doc
    await expect(section.getByText(/4\.7 out of 5/)).toBeVisible();
  });

  test('signed-out visitor sees Sign in link; empty plant shows invite', async ({ page }) => {
    test.setTimeout(90_000);
    await page.goto(`${webBase}/plants/pl-zz`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'ZZ Plant' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { level: 2, name: 'Reviews' })).toBeVisible();
    await expect(page.getByText(/No reviews yet\. Be the first to share how it's growing\./)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Write a review' })).toHaveCount(0);

    const section = page.locator('section[aria-labelledby="reviews-title"]');
    const signIn = section.getByRole('link', { name: 'Sign in' });
    await expect(signIn).toBeVisible();
    await expect(signIn).toHaveAttribute('href', '/login?next=/plants/pl-zz');
    await signIn.click();
    await expect(page).toHaveURL(/\/login\?next=(%2F|\/)plants(%2F|\/)pl-zz/);
  });

  test('signed-in customer can post a review and sees it in the list with thanks toast', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`${webBase}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email').fill(avaEmail);
    await page.getByLabel('Password').fill(avaPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

    await page.goto(`${webBase}/plants/pl-zz`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'ZZ Plant' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'Write a review' })).toBeVisible();

    await page.getByRole('radio', { name: '5 stars' }).click();
    await page.getByLabel('Your review').fill('thrives on my shady shelf');
    await page.getByRole('button', { name: 'Post review' }).click();

    await expect(page.getByText('Thanks for your review!')).toBeVisible({ timeout: 15_000 });
    const section = page.locator('section[aria-labelledby="reviews-title"]');
    await expect(section.getByText('Ava Green')).toBeVisible({ timeout: 15_000 });
    await expect(section.getByText('thrives on my shady shelf')).toBeVisible();
  });

  test('signed-in customer is blocked from a second review on the same plant', async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto(`${webBase}/login`, { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email').fill(avaEmail);
    await page.getByLabel('Password').fill(avaPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

    await page.goto(`${webBase}/plants/pl-zz`, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Write a review' })).toBeVisible({ timeout: 60_000 });

    await page.getByRole('radio', { name: '5 stars' }).click();
    await page.getByLabel('Your review').fill('First review for this ZZ plant.');
    await page.getByRole('button', { name: 'Post review' }).click();
    await expect(page.getByText('Thanks for your review!')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('radio', { name: '4 stars' }).click();
    await page.getByLabel('Your review').fill('Trying to review this plant again.');
    await page.getByRole('button', { name: 'Post review' }).click();
    await expect(page.getByRole('alert')).toContainText(/already reviewed/i);
  });
});
