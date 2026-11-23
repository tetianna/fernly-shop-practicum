import { expect, test } from '@playwright/test';
import { getOpenApiValidator } from '../helpers/schema';

type PopularPlant = {
  id: string;
  name: string;
  unitsSold: number;
  stock: number;
};

type PopularList = {
  days: number;
  items: PopularPlant[];
};

test.describe('popular API', { tag: '@api' }, () => {
  // PP-01 — shape & default: no limit → 200, days 30, ≤4 PopularPlant items, most unitsSold first, no auth
  test('PP-01: GET /api/popular default shape, schema, order, and no auth', async ({ request }) => {
    const openapi = await getOpenApiValidator(request);
    const res = await request.get('/api/popular');
    expect(res.status(), await res.text()).toBe(200);
    const body = (await res.json()) as PopularList;
    openapi.expect('PopularList', body);
    expect(body.days).toBe(30);
    expect(body.items.length).toBeLessThanOrEqual(4);
    expect(body.items.length, 'seed sales should yield popular plants').toBeGreaterThan(0);
    for (const item of body.items) {
      openapi.expect('PopularPlant', item);
      expect(Number.isInteger(item.unitsSold), 'unitsSold is int').toBe(true);
      expect(item.unitsSold).toBeGreaterThanOrEqual(0);
    }
    for (let i = 1; i < body.items.length; i += 1) {
      expect(
        body.items[i - 1].unitsSold,
        `item ${i - 1} unitsSold >= item ${i}`,
      ).toBeGreaterThanOrEqual(body.items[i].unitsSold);
    }
  });

  // PP-02 — limit validation 1–12; bad values → 400 validation_error
  test('PP-02: limit accepted in 1–12 and rejected outside', async ({ request }) => {
    const ok1 = await request.get('/api/popular?limit=1');
    expect(ok1.status(), await ok1.text()).toBe(200);
    const body1 = (await ok1.json()) as PopularList;
    expect(body1.items.length).toBeLessThanOrEqual(1);

    const ok12 = await request.get('/api/popular?limit=12');
    expect(ok12.status(), await ok12.text()).toBe(200);
    const body12 = (await ok12.json()) as PopularList;
    expect(body12.items.length).toBeLessThanOrEqual(12);

    const ok4 = await request.get('/api/popular?limit=4');
    expect(ok4.status(), await ok4.text()).toBe(200);
    const body4 = (await ok4.json()) as PopularList;
    const def = await request.get('/api/popular');
    const bodyDef = (await def.json()) as PopularList;
    expect(body4.items.map((p) => p.id)).toEqual(bodyDef.items.map((p) => p.id));

    for (const bad of ['0', '13', '-1', '1.5', 'abc']) {
      const res = await request.get(`/api/popular?limit=${encodeURIComponent(bad)}`);
      expect(res.status(), `limit=${bad}: ${await res.text()}`).toBe(400);
      const err = (await res.json()) as { rule?: string };
      expect(err.rule, `limit=${bad} rule`).toBe('validation_error');
    }
  });

  // PP-03 — ranking sums sale quantities (workshop trays), not order/row count
  test('PP-03: unitsSold sums quantities so workshop trays rank by units', async ({ request }) => {
    const reset = await request.post('/api/admin/reset');
    expect(reset.ok(), await reset.text()).toBeTruthy();

    const res = await request.get('/api/popular?limit=12');
    expect(res.status(), await res.text()).toBe(200);
    const body = (await res.json()) as PopularList;
    const cutting = body.items.find((p) => p.id === 'pl-cutting');
    expect(cutting, 'Succulent Cutting (workshop trays) should appear in popular').toBeTruthy();
    // 200 workshop sales × qty 40, all within the last 30 days in seed history
    expect(
      cutting!.unitsSold,
      'workshop qty-40 sales must count as 40 units each, not one per order',
    ).toBeGreaterThanOrEqual(200 * 40);
  });

  // PP-04 — 30-day window metadata, name tie-break, OOS omitted, reset determinism
  test('PP-04: OOS omitted, ties by name A–Z, reset list deterministic', async ({ request }) => {
    const reset1 = await request.post('/api/admin/reset');
    expect(reset1.ok(), await reset1.text()).toBeTruthy();

    const first = await request.get('/api/popular?limit=12');
    expect(first.status(), await first.text()).toBe(200);
    const body1 = (await first.json()) as PopularList;
    expect(body1.days).toBe(30);

    expect(
      body1.items.find((p) => p.id === 'pl-pilea'),
      'out-of-stock Chinese Money Plant must be left out',
    ).toBeUndefined();
    for (const item of body1.items) {
      expect(item.stock, `${item.id} must be in stock`).toBeGreaterThan(0);
    }

    for (let i = 1; i < body1.items.length; i += 1) {
      const prev = body1.items[i - 1];
      const curr = body1.items[i];
      if (prev.unitsSold === curr.unitsSold) {
        expect(prev.name.localeCompare(curr.name), 'tie-break A–Z').toBeLessThanOrEqual(0);
      }
    }

    const reset2 = await request.post('/api/admin/reset');
    expect(reset2.ok(), await reset2.text()).toBeTruthy();
    const second = await request.get('/api/popular?limit=12');
    expect(second.status(), await second.text()).toBe(200);
    const body2 = (await second.json()) as PopularList;
    expect(body2.items.map((p) => ({ id: p.id, unitsSold: p.unitsSold }))).toEqual(
      body1.items.map((p) => ({ id: p.id, unitsSold: p.unitsSold })),
    );
  });
});
