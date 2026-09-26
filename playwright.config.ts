import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @university-planner/web dev --hostname 127.0.0.1 --port 3000",
      url: "http://127.0.0.1:3000/api/health",
      env: {
        AUTH_SECRET: "playwright-only-secret-with-at-least-thirty-two-characters",
        AUTH_GOOGLE_ID: "playwright.invalid.apps.googleusercontent.com",
        AUTH_GOOGLE_SECRET: "playwright-only-placeholder",
        NEXTAUTH_URL: "http://127.0.0.1:3000",
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "node scripts/serve-static.mjs prototypes/approved-preview 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
  ],
});
