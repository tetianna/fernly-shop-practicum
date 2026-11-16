import path from 'node:path';
import { expect, test, type APIRequestContext } from '@playwright/test';
import dotenv from 'dotenv';
import { getOpenApiValidator } from '../helpers/schema';

dotenv.config({ path: path.join(process.cwd(), '.env') });

type Cart = {
  lines: { id: string; plantId: string; unitPrice: number; quantity: number; lineTotal: number }[];
  itemCount: number;
  subtotal: number;
  discount: number;
  promoCode: string | null;
  shipping: number;
  total: number;
};

type Order = Cart & {
  id: string;
  status: string;
  shippingAddress: { fullName: string; address: string; city: string; postalCode: string };
};

const address = {
  fullName: 'Ava Fern',
  address: '1 Greenhouse Lane',
  city: 'Portland',
  postalCode: '97201',
};

/** Fresh account per test so carts never collide across workers. */
async function registerAndLogin(request: APIRequestContext): Promise<string> {
  const email = `promo-${Date.now()}-${Math.random().toString(16).slice(2)}@fernly.test`;
  const password = 'Fernly-Promo-2026';
  const res = await request.post('/api/auth/register', {
    data: { name: 'Promo Tester', email, password },
  });
  expect(res.status(), await res.text()).toBe(201);
  const body = (await res.json()) as { token: string };
  return body.token;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function addLine(
  request: APIRequestContext,
  token: string,
  plantId: string,
  size: string,
  quantity = 1,
): Promise<Cart> {
  const res = await request.post('/api/cart/lines', {
    headers: auth(token),
    data: { plantId, size, quantity },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return (await res.json()) as Cart;
}

function roundCents(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

test.describe('promo codes API', { tag: '@api' }, () => {
  test('PC-01: LEAFY10 discounts plant subtotal only, not shipping', async ({ request }) => {
    const openapi = await getOpenApiValidator(request);
    const token = await registerAndLogin(request);

    // Snake Plant S = $22.00 → paid shipping $6.95
    const before = await addLine(request, token, 'pl-snake', 'S');
    expect(before.subtotal).toBe(22);
    expect(before.shipping).toBe(6.95);

    const res = await request.post('/api/cart/promo', {
      headers: auth(token),
      data: { code: 'LEAFY10' },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const cart = (await res.json()) as Cart;
    openapi.expect('Cart', cart);

    const expectedDiscount = roundCents(before.subtotal * 0.1); // 2.20 — plants only
    expect(cart.promoCode).toBe('LEAFY10');
    expect(cart.discount, 'percent off plants only, never shipping').toBe(expectedDiscount);
    expect(cart.shipping, 'shipping line unchanged by percent promo').toBe(6.95);
    expect(cart.total).toBe(roundCents(cart.subtotal - cart.discount + cart.shipping));
  });

  test('PC-02: FREESHIP zeros shipping; unknown code does not', async ({ request }) => {
    const openapi = await getOpenApiValidator(request);
    const token = await registerAndLogin(request);

    const before = await addLine(request, token, 'pl-snake', 'S');
    expect(before.shipping).toBe(6.95);

    const bad = await request.post('/api/cart/promo', {
      headers: auth(token),
      data: { code: 'NOTAREALCODE' },
    });
    expect(bad.status()).toBe(400);
    const afterBad = await request.get('/api/cart', { headers: auth(token) });
    const cartAfterBad = (await afterBad.json()) as Cart;
    expect(cartAfterBad.shipping).toBe(6.95);
    expect(cartAfterBad.promoCode).toBeNull();

    const res = await request.post('/api/cart/promo', {
      headers: auth(token),
      data: { code: 'FREESHIP' },
    });
    expect(res.ok(), await res.text()).toBeTruthy();
    const cart = (await res.json()) as Cart;
    openapi.expect('Cart', cart);

    expect(cart.promoCode).toBe('FREESHIP');
    expect(cart.shipping).toBe(0);
    expect(cart.discount).toBe(0);
    expect(cart.total).toBe(cart.subtotal);
  });

  test('PC-03a: shipping is free at exactly $50.00 subtotal', async ({ request }) => {
    const token = await registerAndLogin(request);
    const atThreshold = await addLine(request, token, 'pl-bird', 'S');
    expect(atThreshold.subtotal).toBe(50);
    expect(atThreshold.shipping, 'shipping free at $50.00 subtotal before any discount').toBe(0);
  });

  test('PC-03b: pre-discount subtotal decides free ship; percent keeps paid ship under $50', async ({
    request,
  }) => {
    // Above $50: Bird of Paradise M = $56
    const tokenAbove = await registerAndLogin(request);
    const above = await addLine(request, tokenAbove, 'pl-bird', 'M');
    expect(above.subtotal).toBeGreaterThan(50);
    expect(above.shipping).toBe(0);

    const leafyAbove = await request.post('/api/cart/promo', {
      headers: auth(tokenAbove),
      data: { code: 'LEAFY10' },
    });
    expect(leafyAbove.ok(), await leafyAbove.text()).toBeTruthy();
    const discountedFreeShip = (await leafyAbove.json()) as Cart;
    expect(discountedFreeShip.shipping, 'LEAFY10 keeps free shipping when pre-discount ≥ $50').toBe(0);
    expect(discountedFreeShip.discount, 'plants-only 10%').toBe(roundCents(above.subtotal * 0.1));

    // Just under $50: Fiddle Leaf Fig S = $49.00
    const tokenUnder = await registerAndLogin(request);
    const under = await addLine(request, tokenUnder, 'pl-fiddle', 'S');
    expect(under.subtotal).toBe(49);
    expect(under.shipping).toBe(6.95);

    const leafyUnder = await request.post('/api/cart/promo', {
      headers: auth(tokenUnder),
      data: { code: 'LEAFY10' },
    });
    expect(leafyUnder.ok(), await leafyUnder.text()).toBeTruthy();
    const stillPaidShip = (await leafyUnder.json()) as Cart;
    expect(stillPaidShip.shipping, 'percent discount must not unlock free shipping').toBe(6.95);
    expect(stillPaidShip.discount, 'plants-only 10%').toBe(roundCents(49 * 0.1));
  });

  test('PC-04: apply replaces code; DELETE removes; case-insensitive; empty code 400', async ({
    request,
  }) => {
    const openapi = await getOpenApiValidator(request);
    const token = await registerAndLogin(request);
    await addLine(request, token, 'pl-snake', 'S');

    const leafy = await request.post('/api/cart/promo', {
      headers: auth(token),
      data: { code: 'leafy10' },
    });
    expect(leafy.ok(), await leafy.text()).toBeTruthy();
    const leafyCart = (await leafy.json()) as Cart;
    openapi.expect('Cart', leafyCart);
    expect(leafyCart.promoCode).toBe('LEAFY10');

    const free = await request.post('/api/cart/promo', {
      headers: auth(token),
      data: { code: 'FREESHIP' },
    });
    expect(free.ok(), await free.text()).toBeTruthy();
    const freeCart = (await free.json()) as Cart;
    expect(freeCart.promoCode).toBe('FREESHIP');
    expect(freeCart.shipping).toBe(0);
    expect(freeCart.discount).toBe(0);

    const removed = await request.delete('/api/cart/promo', { headers: auth(token) });
    expect(removed.ok(), await removed.text()).toBeTruthy();
    const cleared = (await removed.json()) as Cart;
    openapi.expect('Cart', cleared);
    expect(cleared.promoCode).toBeNull();
    expect(cleared.discount).toBe(0);
    expect(cleared.shipping).toBe(6.95);

    const emptyBody = await request.post('/api/cart/promo', {
      headers: auth(token),
      data: {},
    });
    expect(emptyBody.status()).toBe(400);

    const emptyCode = await request.post('/api/cart/promo', {
      headers: auth(token),
      data: { code: '' },
    });
    expect(emptyCode.status()).toBe(400);

    const whitespace = await request.post('/api/cart/promo', {
      headers: auth(token),
      data: { code: '   ' },
    });
    expect(whitespace.status()).toBe(400);
  });

  test('PC-05: unknown, expired, and empty-cart promo refused', async ({ request }) => {
    const token = await registerAndLogin(request);

    const emptyApply = await request.post('/api/cart/promo', {
      headers: auth(token),
      data: { code: 'LEAFY10' },
    });
    expect(emptyApply.status()).toBe(400);
    const emptyBody = (await emptyApply.json()) as { rule?: string; detail?: string };
    expect(emptyBody.rule).toBe('empty_cart');
    expect(emptyBody.detail).toMatch(/add a plant before you use a code/i);

    await addLine(request, token, 'pl-snake', 'S');

    const unknown = await request.post('/api/cart/promo', {
      headers: auth(token),
      data: { code: 'NOPE123' },
    });
    expect(unknown.status()).toBe(400);
    const unknownBody = (await unknown.json()) as { rule?: string; detail?: string };
    expect(unknownBody.rule).toBe('promo_invalid');

    const expired = await request.post('/api/cart/promo', {
      headers: auth(token),
      data: { code: 'SPRING5' },
    });
    expect(expired.status(), 'expired codes must be refused').toBe(400);
    const expiredBody = (await expired.json()) as { rule?: string; detail?: string };
    expect(expiredBody.rule).toBe('promo_invalid');
    expect(expiredBody.detail ?? '', 'message must say the code has expired').toMatch(/expir/i);
  });

  test('PC-06: promo routes require auth; signed-in returns Cart schema', async ({ request }) => {
    const openapi = await getOpenApiValidator(request);

    const postNoAuth = await request.post('/api/cart/promo', { data: { code: 'LEAFY10' } });
    expect(postNoAuth.status()).toBe(401);
    const postBody = (await postNoAuth.json()) as { rule?: string };
    expect(postBody.rule).toBe('auth_required');

    const deleteNoAuth = await request.delete('/api/cart/promo');
    expect(deleteNoAuth.status()).toBe(401);
    const deleteBody = (await deleteNoAuth.json()) as { rule?: string };
    expect(deleteBody.rule).toBe('auth_required');

    const token = await registerAndLogin(request);
    await addLine(request, token, 'pl-snake', 'S');
    const ok = await request.post('/api/cart/promo', {
      headers: auth(token),
      data: { code: 'LEAFY10' },
    });
    expect(ok.ok()).toBeTruthy();
    openapi.expect('Cart', await ok.json());
  });

  test('PC-07: order keeps promo; cart clears after place order', async ({ request }) => {
    const openapi = await getOpenApiValidator(request);
    const token = await registerAndLogin(request);
    await addLine(request, token, 'pl-snake', 'S');

    const promoRes = await request.post('/api/cart/promo', {
      headers: auth(token),
      data: { code: 'LEAFY10' },
    });
    expect(promoRes.ok()).toBeTruthy();
    const cart = (await promoRes.json()) as Cart;

    const orderRes = await request.post('/api/orders', {
      headers: auth(token),
      data: { shippingAddress: address },
    });
    expect(orderRes.status(), await orderRes.text()).toBe(201);
    const order = (await orderRes.json()) as Order;
    openapi.expect('Order', order);

    expect(order.promoCode).toBe(cart.promoCode);
    expect(order.discount).toBe(cart.discount);
    expect(order.total).toBe(cart.total);

    const cartAfter = await request.get('/api/cart', { headers: auth(token) });
    expect(cartAfter.ok()).toBeTruthy();
    const empty = (await cartAfter.json()) as Cart;
    openapi.expect('Cart', empty);
    expect(empty.lines).toEqual([]);
    expect(empty.promoCode).toBeNull();
    expect(empty.discount).toBe(0);
  });
});
