import path from 'node:path';
import { expect, test, type APIRequestContext } from '@playwright/test';
import dotenv from 'dotenv';
import { getOpenApiValidator } from '../helpers/schema';

dotenv.config({ path: path.join(process.cwd(), '.env') });

const avaEmail = process.env.FERNLY_USER_EMAIL ?? 'ava@fernly.test';
const avaPassword = process.env.FERNLY_USER_PASSWORD ?? 'Fernly-Ava-2026';
const benEmail = process.env.FERNLY_ALT_USER_EMAIL ?? 'ben@fernly.test';
const benPassword = process.env.FERNLY_ALT_USER_PASSWORD ?? 'Fernly-Ben-2026';

async function login(request: APIRequestContext, email: string, password: string): Promise<string> {
  const res = await request.post('/api/auth/login', { data: { email, password } });
  expect(res.ok(), `login ${email}`).toBeTruthy();
  const body = (await res.json()) as { token: string };
  expect(body.token, 'token').toBeTruthy();
  return body.token;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

test.describe('plant reviews API', { tag: '@api' }, () => {
  test.beforeEach(async ({ request }) => {
    const reset = await request.post('/api/admin/reset');
    expect(reset.ok(), 'admin reset').toBeTruthy();
  });

  // PR-01
  test('PR-01: author can delete own review; others get 404; unsigned 401', async ({ request }) => {
    const openapi = await getOpenApiValidator(request);
    const avaToken = await login(request, avaEmail, avaPassword);
    const benToken = await login(request, benEmail, benPassword);

    const create = await request.post('/api/plants/pl-peace-lily/reviews', {
      headers: auth(avaToken),
      data: { rating: 5, text: 'Ava loves this Peace Lily a lot.' },
    });
    expect(create.status(), 'author create').toBe(201);
    const created = await create.json();
    openapi.expect('Review', created);
    const reviewId = (created as { id: string }).id;

    const unsigned = await request.delete(`/api/reviews/${reviewId}`);
    expect(unsigned.status(), 'unsigned delete').toBe(401);
    const unsignedBody = (await unsigned.json()) as { rule?: string };
    expect(unsignedBody.rule).toBe('auth_required');

    const other = await request.delete(`/api/reviews/${reviewId}`, { headers: auth(benToken) });
    expect(other.status(), 'non-author delete').toBe(404);
    const otherBody = (await other.json()) as { detail: string };
    expect(otherBody.detail, 'non-author message').toMatch(/Review not found/i);

    const stillThere = await request.get('/api/plants/pl-peace-lily/reviews');
    expect(stillThere.ok()).toBeTruthy();
    const listBefore = (await stillThere.json()) as { reviews: { id: string }[] };
    expect(listBefore.reviews.some((r) => r.id === reviewId), 'review still listed after non-author delete').toBe(
      true,
    );

    const own = await request.delete(`/api/reviews/${reviewId}`, { headers: auth(avaToken) });
    expect(own.status(), 'author delete').toBe(204);

    const after = await request.get('/api/plants/pl-peace-lily/reviews');
    expect(after.ok()).toBeTruthy();
    const listAfter = (await after.json()) as { reviews: { id: string }[] };
    expect(listAfter.reviews.some((r) => r.id === reviewId), 'review gone after author delete').toBe(false);

    const unknown = await request.delete('/api/reviews/rv-does-not-exist', { headers: auth(avaToken) });
    expect(unknown.status(), 'unknown reviewId').toBe(404);
  });

  // PR-02
  test('PR-02: POST review requires session; unknown plant 404', async ({ request }) => {
    const openapi = await getOpenApiValidator(request);
    const avaToken = await login(request, avaEmail, avaPassword);

    const ok = await request.post('/api/plants/pl-zz/reviews', {
      headers: auth(avaToken),
      data: { rating: 4, text: 'Happy with this easy plant.' },
    });
    expect(ok.status()).toBe(201);
    openapi.expect('Review', await ok.json());

    const noAuth = await request.post('/api/plants/pl-zz/reviews', {
      data: { rating: 4, text: 'Should not post without auth.' },
    });
    expect(noAuth.status()).toBe(401);
    const noAuthBody = (await noAuth.json()) as { rule?: string };
    expect(noAuthBody.rule).toBe('auth_required');

    const missingPlant = await request.post('/api/plants/pl-does-not-exist/reviews', {
      headers: auth(avaToken),
      data: { rating: 3, text: 'Plant that does not exist.' },
    });
    expect(missingPlant.status()).toBe(404);
  });

  // PR-04
  test('PR-04: one review per customer per plant; different plant allowed', async ({ request }) => {
    const openapi = await getOpenApiValidator(request);
    const avaToken = await login(request, avaEmail, avaPassword);

    const first = await request.post('/api/plants/pl-zz/reviews', {
      headers: auth(avaToken),
      data: { rating: 5, text: 'First review for ZZ plant.' },
    });
    expect(first.status()).toBe(201);
    openapi.expect('Review', await first.json());

    const second = await request.post('/api/plants/pl-zz/reviews', {
      headers: auth(avaToken),
      data: { rating: 4, text: 'Trying to review ZZ again.' },
    });
    expect(second.status()).toBe(409);
    const conflict = (await second.json()) as { rule?: string };
    expect(conflict.rule).toBe('already_reviewed');

    const otherPlant = await request.post('/api/plants/pl-aloe/reviews', {
      headers: auth(avaToken),
      data: { rating: 5, text: 'Aloe is fine on another plant.' },
    });
    expect(otherPlant.status()).toBe(201);
    openapi.expect('Review', await otherPlant.json());
  });

  // PR-05
  test('PR-05a: GET seeded plant reviews match ReviewList schema, count, newest first', async ({ request }) => {
    const openapi = await getOpenApiValidator(request);

    const seeded = await request.get('/api/plants/pl-snake/reviews');
    expect(seeded.status()).toBe(200);
    const snake = await seeded.json();
    openapi.expect('ReviewList', snake);

    const body = snake as {
      plantId: string;
      average: number;
      count: number;
      reviews: { id: string; rating: number; createdAt: string }[];
    };
    expect(body.plantId).toBe('pl-snake');
    expect(body.count).toBe(body.reviews.length);
    expect(body.count, 'seed snake reviews').toBe(3);

    const createdAts = body.reviews.map((r) => r.createdAt);
    const sorted = [...createdAts].sort((a, b) => b.localeCompare(a));
    expect(createdAts, 'newest first').toEqual(sorted);
  });

  test('PR-05b: GET average for 5+4+5 rounds half-up to 4.7', async ({ request }) => {
    const seeded = await request.get('/api/plants/pl-snake/reviews');
    expect(seeded.status()).toBe(200);
    const body = (await seeded.json()) as { average: number; reviews: { rating: number }[] };
    expect(body.reviews.map((r) => r.rating).sort()).toEqual([4, 5, 5]);
    // 5 + 4 + 5 → 4.666… rounds half-up to 4.7
    expect(body.average, 'average halves up to one decimal').toBe(4.7);
  });

  test('PR-05c: GET empty reviews and unknown plant', async ({ request }) => {
    const openapi = await getOpenApiValidator(request);

    const empty = await request.get('/api/plants/pl-zz/reviews');
    expect(empty.status()).toBe(200);
    const emptyBody = await empty.json();
    openapi.expect('ReviewList', emptyBody);
    expect(emptyBody).toMatchObject({ plantId: 'pl-zz', average: 0, count: 0, reviews: [] });

    const missing = await request.get('/api/plants/pl-does-not-exist/reviews');
    expect(missing.status()).toBe(404);
  });

  // PR-06
  test('PR-06: POST body validation for rating and text length', async ({ request }) => {
    const avaToken = await login(request, avaEmail, avaPassword);
    const headers = auth(avaToken);

    const rating1 = await request.post('/api/plants/pl-zz/reviews', {
      headers,
      data: { rating: 1, text: 'ten chars!' },
    });
    expect(rating1.status(), 'rating 1 + text 10').toBe(201);

    await request.post('/api/admin/reset');
    const avaAgain = await login(request, avaEmail, avaPassword);
    const headers2 = auth(avaAgain);

    const rating5 = await request.post('/api/plants/pl-zz/reviews', {
      headers: headers2,
      data: { rating: 5, text: 'x'.repeat(500) },
    });
    expect(rating5.status(), 'rating 5 + text 500').toBe(201);

    await request.post('/api/admin/reset');
    const token = await login(request, avaEmail, avaPassword);
    const h = auth(token);

    for (const [label, data] of [
      ['rating 0', { rating: 0, text: 'long enough text' }],
      ['rating 6', { rating: 6, text: 'long enough text' }],
      ['rating 3.5', { rating: 3.5, text: 'long enough text' }],
      ['text 9', { rating: 3, text: '123456789' }],
      ['text 501', { rating: 3, text: 'x'.repeat(501) }],
    ] as const) {
      const res = await request.post('/api/plants/pl-aloe/reviews', { headers: h, data });
      expect(res.status(), label).toBe(400);
      const body = (await res.json()) as { rule?: string };
      expect(body.rule, label).toBe('validation_error');
    }

    const paddedShort = await request.post('/api/plants/pl-aloe/reviews', {
      headers: h,
      data: { rating: 4, text: '   short    ' },
    });
    expect(paddedShort.status(), 'trimmed below min length').toBe(400);
    expect(((await paddedShort.json()) as { rule?: string }).rule).toBe('validation_error');

    const paddedOk = await request.post('/api/plants/pl-aloe/reviews', {
      headers: h,
      data: { rating: 4, text: '   ten chars!   ' },
    });
    expect(paddedOk.status(), 'trimmed meets min length').toBe(201);
    const okBody = (await paddedOk.json()) as { text: string };
    expect(okBody.text).toBe('ten chars!');
  });
});
