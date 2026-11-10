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

  // PC-13 / PC-14 — use baseline page names (`cart` / `checkout`) so known PriceTag
  // contrast stays baselined; new promo-control issues still surface as blocking.
  test.describe('promo accessibility', () => {
    async function clearPromoIfNeeded(page: Page): Promise<void> {
      const removePromo = page.getByRole('button', { name: 'Remove', exact: true });
      if (await removePromo.isVisible().catch(() => false)) {
        await removePromo.click();
      }
    }

    async function ensureCartWithPromoField(page: Page): Promise<void> {
      await page.goto('/cart', { waitUntil: 'domcontentloaded' });
      await expect(
        page.getByRole('heading', { name: 'Your cart' }).or(page.getByRole('heading', { name: 'Your cart is empty' })),
      ).toBeVisible({ timeout: 30_000 });
      if (await page.getByRole('heading', { name: 'Your cart is empty' }).isVisible()) {
        await addMonsteraToCart(page);
        await page.goto('/cart', { waitUntil: 'domcontentloaded' });
      }
      await clearPromoIfNeeded(page);
      await expect(page.getByRole('button', { name: 'Apply' })).toBeVisible({ timeout: 15_000 });
    }

    test('PC-13: Cart (/cart) empty signed-in has no blocking axe findings', async ({ page }, testInfo) => {
      await signInAsFirstCustomer(page);
      await page.goto('/cart', { waitUntil: 'domcontentloaded' });
      await clearPromoIfNeeded(page);
      const removeLine = page.getByRole('button', { name: /^Remove / });
      while ((await removeLine.count()) > 0) {
        const before = await removeLine.count();
        await removeLine.first().click();
        await expect
          .poll(async () => {
            if (await page.getByRole('heading', { name: 'Your cart is empty' }).isVisible()) return 0;
            return removeLine.count();
          })
          .toBeLessThan(before);
      }
      await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible({
        timeout: 30_000,
      });
      const { blocking } = await scanPage(page, testInfo, { name: 'cart' });
      expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
    });

    test('PC-13: Cart (/cart) with plant and promo field has no blocking axe findings', async ({
      page,
    }, testInfo) => {
      await signInAsFirstCustomer(page);
      await ensureCartWithPromoField(page);
      const { blocking } = await scanPage(page, testInfo, { name: 'cart' });
      expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
    });

    test('PC-13: Cart (/cart) with applied promo has no blocking axe findings', async ({ page }, testInfo) => {
      await signInAsFirstCustomer(page);
      await ensureCartWithPromoField(page);
      const codeField = page
        .locator('form')
        .filter({ has: page.getByRole('button', { name: 'Apply' }) })
        .locator('input');
      await codeField.fill('LEAFY10');
      await page.getByRole('button', { name: 'Apply' }).click();
      await expect(page.getByText('Discount (LEAFY10)')).toBeVisible({ timeout: 15_000 });
      const { blocking } = await scanPage(page, testInfo, { name: 'cart' });
      expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
    });

    test('PC-13: Cart (/cart) promo error state has no blocking axe findings', async ({ page }, testInfo) => {
      await signInAsFirstCustomer(page);
      await ensureCartWithPromoField(page);
      const codeField = page
        .locator('form')
        .filter({ has: page.getByRole('button', { name: 'Apply' }) })
        .locator('input');
      await codeField.fill('NOPE123');
      await page.getByRole('button', { name: 'Apply' }).click();
      await expect(page.getByText(/don.?t recognize|not recognize|invalid|unknown/i)).toBeVisible({
        timeout: 15_000,
      });
      const { blocking } = await scanPage(page, testInfo, { name: 'cart' });
      expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
    });

    test('PC-14: Checkout with discount row has no blocking axe findings', async ({ page }, testInfo) => {
      await signInAsFirstCustomer(page);
      await ensureCartWithPromoField(page);
      const codeField = page
        .locator('form')
        .filter({ has: page.getByRole('button', { name: 'Apply' }) })
        .locator('input');
      await codeField.fill('LEAFY10');
      await page.getByRole('button', { name: 'Apply' }).click();
      await expect(page.getByText('Discount (LEAFY10)')).toBeVisible({ timeout: 15_000 });
      await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText('Discount (LEAFY10)')).toBeVisible({ timeout: 15_000 });
      const { blocking } = await scanPage(page, testInfo, { name: 'checkout' });
      expect(blocking, formatBlockingMessage(blocking)).toEqual([]);
    });
  });
});
