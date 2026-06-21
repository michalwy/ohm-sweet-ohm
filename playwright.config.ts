import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";
const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://oso:oso_e2e_password@localhost:5433/ohm_sweet_ohm_e2e?schema=public";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL,
    trace: "on-first-retry"
  },
  expect: {
    timeout: 10000
  },
  webServer: {
    command: `DATABASE_URL="${databaseUrl}" BETTER_AUTH_URL="${baseURL}" BETTER_AUTH_SECRET="ohm-sweet-ohm-e2e-auth-secret-value" OSO_E2E_SUPPLIER_FIXTURE=1 NEXT_TELEMETRY_DISABLED=1 NEXT_DIST_DIR=".next-e2e" pnpm dev --hostname 127.0.0.1 --port 3100 --webpack`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
