import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.ESS_E2E_PORT || 4173);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 7_000 },
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
  ],
  webServer: [
    {
      // The browser app proxies unmatched /api requests to port 5000. Start the
      // real API against the disposable CI database so dashboard-wide effects
      // (wallet, billing, profile and notifications) never hit a dead proxy.
      command: "npm run dev -w apps/api",
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
