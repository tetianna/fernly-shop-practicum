import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '.env') });

const apiUrl = (process.env.API_URL ?? 'http://localhost:8100').replace(/\/$/, '');
const webUrl = (process.env.WEB_URL ?? 'http://localhost:5173').replace(/\/$/, '');

export default defineConfig({
  testDir: 'tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    [
      './tests/a11y/reporter.ts',
      {
        outputFolder: 'a11y-report',
        baseline: 'tests/a11y/a11y-baseline.json',
        title: 'Fernly accessibility',
      },
    ],
  ],
  use: {
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'npm run start:api',
      url: `${apiUrl.replace(/\/$/, '')}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run start:web',
      url: webUrl.replace(/\/$/, ''),
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    {
      name: 'setup',
      testMatch: /reset\.setup\.ts/,
      use: { baseURL: apiUrl },
    },
    {
      name: 'api',
      testMatch: /api\/.*\.spec\.ts/,
      dependencies: ['setup'],
      use: { baseURL: apiUrl },
    },
    {
      name: 'e2e',
      testMatch: /e2e\/.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: webUrl,
      },
    },
    {
      name: 'a11y',
      testMatch: /a11y\/.*\.spec\.ts/,
      dependencies: ['setup'],
      use: {
        ...devices['Desktop Chrome'],
        baseURL: webUrl,
      },
    },
  ],
});
