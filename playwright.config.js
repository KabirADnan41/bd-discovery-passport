import { defineConfig, devices } from '@playwright/test';

// E2E runs against `wrangler pages dev`: the production build, the real Pages Functions,
// a local D1 database, and the real public/_headers (so every test also runs under the CSP).
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false, // one local D1 + rate limits: keep account tests ordered
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8788',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npx wrangler pages dev --port 8788 --ip 127.0.0.1',
    url: 'http://127.0.0.1:8788',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
