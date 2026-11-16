import { test as setup } from '@playwright/test';

setup('reset seed data', async ({ request }) => {
  const res = await request.post('/api/admin/reset');
  if (!res.ok()) {
    throw new Error(`POST /api/admin/reset failed: ${res.status()} ${await res.text()}`);
  }
});
