import type { APIRequestContext, Page } from '@playwright/test';
import { expect } from '@playwright/test';

const TOKEN_KEY = 'fernly_token';

const email = process.env.FERNLY_USER_EMAIL ?? 'ava@fernly.test';
const password = process.env.FERNLY_USER_PASSWORD ?? 'Fernly-Ava-2026';
const apiUrl = (process.env.API_URL ?? 'http://localhost:8100').replace(/\/$/, '');

export type ToolName = 'search_plants' | 'open_plant' | 'add_to_cart' | 'care_tip';

export interface RecordedCall {
  name: ToolName;
  args: Record<string, unknown>;
  source: 'model' | 'direct';
  at: string;
}

export async function freshCustomer(page: Page, request: APIRequestContext): Promise<void> {
  const reset = await request.post(`${apiUrl}/api/admin/reset`);
  if (!reset.ok()) {
    throw new Error(`POST /api/admin/reset failed: ${reset.status()} ${await reset.text()}`);
  }

  const login = await request.post(`${apiUrl}/api/auth/login`, {
    data: { email, password },
  });
  if (!login.ok()) {
    throw new Error(`POST /api/auth/login failed: ${login.status()} ${await login.text()}`);
  }
  const { token } = (await login.json()) as { token: string };

  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [TOKEN_KEY, token] as const,
  );
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByText(/Hi,\s*/)).toBeVisible({ timeout: 20_000 });
}

export class HelperPage {
  constructor(readonly page: Page) {}

  async open(): Promise<void> {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(this.page.getByRole('heading', { level: 1, name: /every windowsill/i })).toBeVisible({
      timeout: 60_000,
    });
    const toggle = this.page.getByRole('button', { name: /Ask Fernly|Close helper/ });
    if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
      await toggle.click();
    }
    await expect(this.page.locator('#fernly-helper')).toBeVisible();
    await this.page.evaluate(() => window.__fernlyHelper?.clear());
  }

  async ask(phrase: string): Promise<void> {
    const input = this.page.getByLabel('Message the helper');
    await input.fill(phrase);
    await this.page.getByRole('button', { name: 'Send' }).click();

    const log = this.page.getByRole('log');
    await expect(log).toHaveAttribute('aria-busy', 'false', { timeout: 60_000 });
    await expect(log.locator('li').last()).toBeVisible();
  }

  async run(tool: ToolName, args: Record<string, unknown>): Promise<void> {
    const cartLine =
      tool === 'add_to_cart'
        ? this.page.waitForResponse(
            (res) => res.url().includes('/api/cart/lines') && res.request().method() === 'POST',
            { timeout: 30_000 },
          )
        : null;
    await this.page.evaluate(
      async ([name, toolArgs]) => {
        await window.__fernlyHelper?.run(
          name as 'search_plants' | 'open_plant' | 'add_to_cart' | 'care_tip',
          toolArgs as Record<string, unknown>,
        );
      },
      [tool, args] as const,
    );
    if (cartLine) {
      await cartLine;
      await this.page.waitForTimeout(250);
    }
  }

  async lastModelCall(): Promise<RecordedCall | null> {
    return this.page.evaluate(() => {
      const calls = window.__fernlyHelper?.calls ?? [];
      for (let i = calls.length - 1; i >= 0; i -= 1) {
        if (calls[i].source === 'model') return calls[i];
      }
      return null;
    });
  }

  async chatText(): Promise<string> {
    return this.page.locator('#fernly-helper [role="log"]').innerText();
  }

  cartLink() {
    return this.page.getByRole('link', { name: /Cart/ });
  }
}