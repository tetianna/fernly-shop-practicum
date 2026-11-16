import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const email = process.env.FERNLY_USER_EMAIL ?? 'ava@fernly.test';
const password = process.env.FERNLY_USER_PASSWORD ?? 'Fernly-Ava-2026';

const address = {
  fullName: 'Ava Fern',
  street: '1 Greenhouse Lane',
  city: 'Portland',
  postal: '97201',
};

async function signIn(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });
}

async function addPlantToCart(page: Page, plantPath: string): Promise<void> {
  await page.goto(plantPath, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText(/Added .* to your cart/)).toBeVisible({ timeout: 15_000 });
}

async function emptyCart(page: Page): Promise<void> {
  await page.goto('/cart', { waitUntil: 'domcontentloaded' });
  await expect(
    page.getByRole('heading', { name: 'Your cart' }).or(page.getByRole('heading', { name: 'Your cart is empty' })),
  ).toBeVisible({ timeout: 30_000 });

  const emptyHeading = page.getByRole('heading', { name: 'Your cart is empty' });
  if (await emptyHeading.isVisible()) return;

  // Clear promo first if present (exact "Remove", not "Remove <plant>")
  const removePromo = page.getByRole('button', { name: 'Remove', exact: true });
  if (await removePromo.isVisible().catch(() => false)) {
    await removePromo.click();
  }

  const removeButtons = page.getByRole('button', { name: /^Remove / });
  while ((await removeButtons.count()) > 0) {
    const countBefore = await removeButtons.count();
    await removeButtons.first().click();
    await expect
      .poll(async () => {
        if (await emptyHeading.isVisible()) return 0;
        return removeButtons.count();
      })
      .toBeLessThan(countBefore);
  }
  await expect(emptyHeading).toBeVisible({ timeout: 15_000 });
}

async function promoCodeField(page: Page) {
  const apply = page.getByRole('button', { name: 'Apply' });
  await expect(apply).toBeVisible({ timeout: 15_000 });
  return page.locator('form').filter({ has: apply }).locator('input');
}

test.describe('promo codes e2e', { tag: '@e2e' }, () => {
  test('PC-12a: unknown and expired codes are refused on /cart', async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    await emptyCart(page);
    await addPlantToCart(page, '/plants/pl-snake');
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Your cart' })).toBeVisible({ timeout: 30_000 });

    const apply = page.getByRole('button', { name: 'Apply' });
    const codeField = await promoCodeField(page);

    await codeField.fill('NOPE123');
    await apply.click();
    await expect(page.getByText(/don.?t recognize|not recognize|invalid|unknown/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/Discount \(/)).toHaveCount(0);

    // If a prior bad apply left the form, clear and try expired code
    await codeField.fill('SPRING5');
    await apply.click();
    await expect(page.getByText(/expir/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Discount \(/)).toHaveCount(0);
  });

  test('PC-12b: FREESHIP under $50 shows Free shipping; replace/remove works', async ({ page }) => {
    test.setTimeout(90_000);
    await signIn(page);
    await emptyCart(page);
    await addPlantToCart(page, '/plants/pl-snake');
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });

    const apply = page.getByRole('button', { name: 'Apply' });
    await (await promoCodeField(page)).fill('FREESHIP');
    await apply.click();
    await expect(page.getByText(/^Free$/)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Remove', exact: true }).click();
    await expect(apply).toBeVisible({ timeout: 10_000 });
  });

  test('PC-12c: LEAFY10 through checkout; order keeps discount; cart clears', async ({ page }) => {
    test.setTimeout(120_000);
    await signIn(page);
    await emptyCart(page);
    await addPlantToCart(page, '/plants/pl-snake');
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });

    const apply = page.getByRole('button', { name: 'Apply' });
    await (await promoCodeField(page)).fill('leafy10');
    await apply.click();
    await expect(page.getByText(/Discount \(LEAFY10\)/i)).toBeVisible({ timeout: 10_000 });

    await page.getByRole('link', { name: /go to checkout/i }).click();
    await expect(page.getByRole('heading', { name: 'Checkout' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/Discount \(LEAFY10\)/i)).toBeVisible();

    await page.getByLabel('Full name').fill(address.fullName);
    await page.getByLabel('Street address').fill(address.street);
    await page.getByLabel('City').fill(address.city);
    await page.getByLabel('Postal code').fill(address.postal);
    await page.getByRole('button', { name: 'Place order' }).click();

    await expect(page).toHaveURL(/\/orders\/ord-/, { timeout: 30_000 });
    await expect(page.getByRole('heading', { level: 2, name: 'Paid' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(/Discount \(LEAFY10\)/i)).toBeVisible();

    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/Discount \(/)).toHaveCount(0);
  });
});
