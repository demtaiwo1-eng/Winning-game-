import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.ESS_E2E_PORT || 4173);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL,
    // Keep Playwright's page.route() fixtures in control of API traffic.
    // A registered PWA service worker bypasses page.route() and sends requests
    // to Vite's unavailable local API proxy during isolated browser journeys.
    serviceWorkers: "block",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      grepInvert: /@mobile/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      grep: /@mobile/,
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: [
    {
      // Start the real API against the disposable CI PostgreSQL service. This
      // prevents dashboard requests from being sent to an unavailable proxy.
      command: "cd ../.. && npm run prisma:generate -w apps/api && npm run dev -w apps/api",
      url: "http://127.0.0.1:5000/health",
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
      env: {
        NODE_ENV: "test",
        DATABASE_MODE: "local",
        PORT: "5000",
        DATABASE_URL_LOCAL: process.env.DATABASE_URL_LOCAL || "postgresql://ess:ess_test_password@127.0.0.1:5432/ess_test?schema=public",
        DATABASE_URL: process.env.DATABASE_URL || process.env.DATABASE_URL_LOCAL || "postgresql://ess:ess_test_password@127.0.0.1:5432/ess_test?schema=public",
        JWT_SECRET: process.env.JWT_SECRET || "e2e-only-secret-change-me-0123456789abcdef",
      },
    },
    {
      command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
      url: baseURL,
      timeout: 120_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
