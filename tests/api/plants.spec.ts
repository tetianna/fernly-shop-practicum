import { expect, test } from '@playwright/test';
import { getOpenApiValidator } from '../helpers/schema';

test.describe('plants API', { tag: '@api' }, () => {
  test('GET one plant matches OpenAPI Plant schema', async ({ request }) => {
    const openapi = await getOpenApiValidator(request);
    const listRes = await request.get('/api/plants?pageSize=1');
    expect(listRes.ok()).toBeTruthy();
    const list = (await listRes.json()) as { items: { id: string }[] };
    const id = list.items[0]?.id;
    expect(id, 'catalog has at least one plant').toBeTruthy();

    const plantRes = await request.get(`/api/plants/${id}`);
    expect(plantRes.ok()).toBeTruthy();
    const plant = await plantRes.json();
    openapi.expect('Plant', plant);
  });

  test('GET browse with sort=price-desc returns most expensive plant first', async ({ request }) => {
    const res = await request.get('/api/plants?sort=price-desc&pageSize=12');
    expect(res.ok()).toBeTruthy();
    const data = (await res.json()) as { items: { price: number }[] };
    expect(data.items.length, 'need at least two priced plants').toBeGreaterThan(1);

    const prices = data.items.map((p) => p.price);
    const sorted = [...prices].sort((a, b) => b - a);
    expect(prices[0], 'first item should be highest price').toBe(sorted[0]);
  });
});
