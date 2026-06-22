import { expect, type Page } from "@playwright/test";

export async function signInAsOwner(page: Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill("owner@ohmsweetohm.local");
  await page.getByLabel("Password").fill("ohm-sweet-ohm-owner");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(workspaces|w\/default\/parts)$/);
  if (page.url().includes("/workspaces")) {
    await page.getByRole("link", { name: "Open" }).click();
    await expect(page).toHaveURL(/\/w\/default\/parts$/);
  }
}
