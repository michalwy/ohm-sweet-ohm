import { chromium } from "@playwright/test";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3100";

const PROTECTED_ROUTES = [
  "/workspaces",
  "/w/default/parts",
  "/w/default/locations",
  "/w/default/inventory",
  "/w/default/units",
  "/w/default/part-categories",
  "/w/default/settings/general",
  "/w/default/purchase-orders",
  "/w/default/shopping-lists",
];

export default async function globalSetup() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Warm up public routes first
  await page.goto(`${BASE_URL}/sign-up`, { waitUntil: "domcontentloaded", timeout: 60000 });

  // Sign in to trigger compilation of authenticated routes
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.getByLabel("Email").fill("owner@ohmsweetohm.local");
  await page.getByLabel("Password").fill("ohm-sweet-ohm-owner");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(workspaces|w\/default\/parts)$/, { timeout: 60000 });

  for (const route of PROTECTED_ROUTES) {
    try {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded", timeout: 60000 });
    } catch {
      // Route may redirect or be unavailable — ignore
    }
  }

  await browser.close();
}
