import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import dotenv from 'dotenv';
import { formatBlockingMessage } from './baseline';
import { scanPage } from './helpers/scan';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const firstCustomerEmail = process.env.FERNLY_USER_EMAIL ?? 'ava@fernly.test';
const firstCustomerPassword = process.env.FERNLY_USER_PASSWORD ?? 'Fernly-Ava-2026';

async function signInAsFirstCustomer(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill(firstCustomerEmail);
  await page.getByLabel('Password').fill(firstCustomerPassword);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

async function addMonsteraToCart(page: Page): Promise<void> {
  await page.goto('/plants/pl-monstera', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText(/Added .* to your cart/)).toBeVisible({ timeout: 15_000 });
}

test.describe('accessibility scans', { tag: '@a11y' }, () => {
  test('Browse (/) has no blocking axe findings', async ({ page }, testInfo) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 60_000 });
    const { blocking } = await scanPage(page, testInfo, { name: 'browse' });
    expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
  });

  test('Plant detail (/plants/pl-monstera) has no blocking axe findings', async ({ page }, testInfo) => {
    await page.goto('/plants/pl-monstera', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 60_000 });
    const { blocking } = await scanPage(page, testInfo, { name: 'plant' });
    expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
  });

  // PR-12 — Reviews section present (signed out)
  test('Plant Reviews section signed out (/plants/pl-snake) has no blocking axe findings', async ({ page }, testInfo) => {
    await page.goto('/plants/pl-snake', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Snake Plant' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { level: 2, name: 'Reviews' })).toBeVisible();
    const reviewsSection = page.locator('section[aria-labelledby="reviews-title"]');
    await expect(reviewsSection.getByRole('link', { name: 'Sign in' })).toBeVisible();
    const { blocking } = await scanPage(page, testInfo, { name: 'plant-reviews-signed-out' });
    expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
  });

  // PR-12 — Reviews form visible (signed in)
  test('Plant Reviews section signed in with form (/plants/pl-zz) has no blocking axe findings', async ({
    page,
  }, testInfo) => {
    await signInAsFirstCustomer(page);
    await page.goto('/plants/pl-zz', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'ZZ Plant' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { level: 2, name: 'Reviews' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Write a review' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Your rating' })).toBeVisible();
    await expect(page.getByLabel('Your review')).toBeVisible();
    const { blocking } = await scanPage(page, testInfo, { name: 'plant-reviews-signed-in' });
    expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
  });

  test('Sign in (/login) has no blocking axe findings', async ({ page }, testInfo) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible({ timeout: 30_000 });
    const { blocking } = await scanPage(page, testInfo, { name: 'sign-in' });
    expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
  });

  test('Cart (/cart) signed in with one plant has no blocking axe findings', async ({ page }, testInfo) => {
    await signInAsFirstCustomer(page);
    await addMonsteraToCart(page);
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible({ timeout: 30_000 });
    const { blocking } = await scanPage(page, testInfo, { name: 'cart' });
    expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
  });

  test('Checkout (/checkout) signed in with one plant has no blocking axe findings', async ({ page }, testInfo) => {
    await signInAsFirstCustomer(page);
    await addMonsteraToCart(page);
    await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible({ timeout: 30_000 });
    const { blocking } = await scanPage(page, testInfo, { name: 'checkout' });
    expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
  });
});
