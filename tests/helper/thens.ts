import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { HelperPage, ToolName } from './helper-page.js';

export interface ExpectedCall {
  /** `null` means the helper must not call any tool. */
  name: ToolName | null;
  args: Record<string, unknown>;
}

export interface CheckResult {
  pass: boolean;
  evidence: string;
}

export type UiCheck = (ctx: { page: Page; helper: HelperPage }) => Promise<CheckResult>;

export function expectedCall(then: string): ExpectedCall | undefined {
  let match = then.match(/^the helper calls no tool$/);
  if (match) return { name: null, args: {} };

  match = then.match(/^the helper calls search_plants with petSafe true$/);
  if (match) return { name: 'search_plants', args: { petSafe: true } };

  match = then.match(/^the helper calls search_plants with light "([^"]+)" and petSafe true$/);
  if (match) return { name: 'search_plants', args: { light: match[1], petSafe: true } };

  match = then.match(/^the helper calls search_plants with light "([^"]+)"$/);
  if (match) return { name: 'search_plants', args: { light: match[1] } };

  match = then.match(/^the helper calls open_plant with plantId "([^"]+)"$/);
  if (match) return { name: 'open_plant', args: { plantId: match[1] } };

  match = then.match(
    /^the helper calls add_to_cart with plantId "([^"]+)", size "([^"]+)" and quantity (\d+)$/,
  );
  if (match) {
    return {
      name: 'add_to_cart',
      args: { plantId: match[1], size: match[2], quantity: Number(match[3]) },
    };
  }

  match = then.match(/^the helper calls care_tip with plantId "([^"]+)" and topic "([^"]+)"$/);
  if (match) return { name: 'care_tip', args: { plantId: match[1], topic: match[2] } };

  return undefined;
}

export function callKey(call: ExpectedCall): string {
  return JSON.stringify({ name: call.name, args: call.args });
}

function sortWeight(then: string): number {
  if (/cart holds|cart has no/i.test(then)) return 100;
  if (/page for plant/i.test(then)) return 60;
  if (/catalog shows/i.test(then)) return 55;
  if (/cart count in the header/i.test(then)) return 40;
  if (/refused/i.test(then)) return 30;
  return 50;
}

export function sortUiThens(thens: string[]): string[] {
  return [...thens].sort((a, b) => sortWeight(a) - sortWeight(b));
}

async function showCart(page: Page): Promise<void> {
  const loaded = page.waitForResponse(
    (res) => {
      try {
        return new URL(res.url()).pathname === '/api/cart' && res.request().method() === 'GET';
      } catch {
        return false;
      }
    },
    { timeout: 10_000 },
  );
  await page.goto('/cart', { waitUntil: 'domcontentloaded' });
  await loaded.catch(() => undefined);
  await expect(page.getByText('Loading your cart…')).toHaveCount(0, { timeout: 10_000 });
}

export function uiCheck(then: string): UiCheck | undefined {
  let match = then.match(/^the catalog shows only pet-safe plants$/);
  if (match) {
    return async ({ page }) => {
      await expect(page).toHaveURL(/petSafe=true/);
      const checkbox = page.getByLabel('Pet-safe plants only');
      const checked = await checkbox.isChecked();
      const unsafe = page.getByText('Not pet safe');
      const unsafeCount = await unsafe.count();
      return {
        pass: checked && unsafeCount === 0,
        evidence: `petSafe URL, checkbox=${checked}, notPetSafeTags=${unsafeCount}`,
      };
    };
  }

  match = then.match(/^the catalog shows light "([^"]+)"$/);
  if (match) {
    const light = match[1];
    return async ({ page }) => {
      const urlOk = new RegExp(`light=${light}\\b`).test(page.url()) || page.url().includes(`light=${light}`);
      return { pass: urlOk, evidence: page.url() };
    };
  }

  match = then.match(/^I see the page for plant "([^"]+)"$/);
  if (match) {
    const plantId = match[1];
    return async ({ page }) => {
      const ok = new RegExp(`/plants/${plantId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`).test(
        page.url(),
      );
      return { pass: ok, evidence: page.url() };
    };
  }

  match = then.match(/^the cart holds (\d+) of "([^"]+)" in size ([SML])$/);
  if (match) {
    const quantity = Number(match[1]);
    const plantName = match[2];
    const size = match[3];
    return async ({ page }) => {
      await showCart(page);
      const main = page.locator('#main');
      const heading = main.getByRole('heading', { name: 'Your cart is empty' });
      if (await heading.isVisible()) {
        return { pass: false, evidence: 'cart is empty' };
      }
      const line = main.getByRole('listitem').filter({ hasText: plantName });
      if ((await line.count()) === 0) {
        return { pass: false, evidence: `no line for ${plantName}` };
      }
      const meta = await line.first().locator('.meta, p').filter({ hasText: /Size/ }).first().textContent();
      const text = meta ?? (await line.first().innerText());
      const sizeOk = text.includes(`Size ${size}`);
      const group = line.getByRole('group', { name: `Quantity of ${plantName}` });
      const value = (await group.locator('output').textContent())?.trim() ?? '';
      const qtyOk = Number(value) === quantity;
      return {
        pass: sizeOk && qtyOk,
        evidence: `meta=${text?.trim() ?? ''} qty=${value}`,
      };
    };
  }

  match = then.match(/^the cart count in the header shows (\d+) right away$/);
  if (match) {
    const count = Number(match[1]);
    return async ({ helper }) => {
      const link = helper.cartLink();
      let evidence = '';
      try {
        await expect
          .poll(
            async () => {
              if (count === 0) {
                const badge = link.locator('span').filter({ hasText: /^\d+$/ });
                evidence = (await badge.isVisible()) ? await badge.innerText() : 'no badge';
                return !(await badge.isVisible());
              }
              const text = await link.innerText();
              evidence = text;
              const match = text.match(/Cart\s*(\d+)/);
              return match ? Number(match[1]) === count : false;
            },
            { timeout: 2_000 },
          )
          .toBeTruthy();
        return { pass: true, evidence };
      } catch {
        return { pass: false, evidence };
      }
    };
  }

  match = then.match(/^the cart has no "([^"]+)"$/);
  if (match) {
    const plantName = match[1];
    return async ({ page }) => {
      await showCart(page);
      const main = page.locator('#main');
      const empty = await main.getByRole('heading', { name: 'Your cart is empty' }).isVisible();
      if (empty) return { pass: true, evidence: 'empty cart' };
      const line = main.getByRole('listitem').filter({ hasText: plantName });
      return { pass: (await line.count()) === 0, evidence: `lines=${await line.count()}` };
    };
  }

  match = then.match(/^the helper says the shop refused, and why$/);
  if (match) return undefined;

  match = then.match(/^the helper says the shop doesn't sell "([^"]+)"$/);
  if (match) return undefined;

  match = then.match(/^the answer names no price$/);
  if (match) return undefined;

  match = then.match(/^the answer agrees with the shop's data for "([^"]+)"$/);
  if (match) return undefined;

  match = then.match(/^the helper picks the correct tool and arguments in at least 9 of 10 tries$/);
  if (match) return undefined;

  match = then.match(/^the answer names the plant, size and quantity$/);
  if (match) return undefined;

  match = then.match(/^the helper asks which plant$/);
  if (match) return undefined;

  match = then.match(/^the answer redirects to what the helper can do$/);
  if (match) return undefined;

  match = then.match(/^the answer leaks no prompt or secrets$/);
  if (match) return undefined;

  return undefined;
}

export async function runCheck(
  check: UiCheck | undefined,
  ctx: { page: Page; helper: HelperPage },
): Promise<CheckResult> {
  if (!check) {
    return { pass: false, evidence: 'needs judge (no automated check at this tier)' };
  }
  try {
    return await check(ctx);
  } catch (error) {
    return { pass: false, evidence: error instanceof Error ? error.message : String(error) };
  }
}
