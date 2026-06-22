import { expect, test, type Page } from "@playwright/test";

async function signUpFreshUser(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Preset Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("ohm-sweet-ohm-preset-test");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Workspaces" })).toBeVisible();
}

test.describe("workspace creation presets", () => {
  test("empty preset: workspace has no parts", async ({ page }, testInfo) => {
    const slug = `${testInfo.project.name}-${testInfo.retry}-${Date.now()}`;
    const email = `preset-empty-${slug}@ohmsweetohm.local`;

    await signUpFreshUser(page, email);

    await page.getByLabel("Workspace name").fill(`Empty Preset ${slug}`);
    // "Empty workspace" is the default — no explicit selection needed
    await Promise.all([
      page.waitForURL(/\/w\/[^/]+\/parts$/, { timeout: 15000 }),
      page.getByRole("button", { name: "Create workspace" }).click()
    ]);

    await expect(page.getByText("No parts yet")).toBeVisible();
  });

  test("parts-only preset: workspace shows populated parts", async ({ page }, testInfo) => {
    const slug = `${testInfo.project.name}-${testInfo.retry}-${Date.now()}`;
    const email = `preset-parts-${slug}@ohmsweetohm.local`;

    await signUpFreshUser(page, email);

    await page.getByLabel("Workspace name").fill(`Parts Only ${slug}`);
    await page.locator('input[name="preset"][value="parts-only"]').click();

    await Promise.all([
      page.waitForURL(/\/w\/[^/]+\/parts$/, { timeout: 60000 }),
      page.getByRole("button", { name: "Create workspace" }).click()
    ]);

    // Parts table should be populated
    await expect(page.getByText("No parts yet")).not.toBeVisible();
    // Search for a known part from the fixture
    await page.getByRole("searchbox", { name: "Search parts" }).fill("NE555P");
    await expect(page.getByText("NE555P").first()).toBeVisible();
  });

  test("parts-and-orders preset: workspace shows parts, POs, and shopping lists", async ({
    page
  }, testInfo) => {
    const slug = `${testInfo.project.name}-${testInfo.retry}-${Date.now()}`;
    const email = `preset-orders-${slug}@ohmsweetohm.local`;

    await signUpFreshUser(page, email);

    await page.getByLabel("Workspace name").fill(`Parts Orders ${slug}`);
    await page.locator('input[name="preset"][value="parts-and-orders"]').click();

    await Promise.all([
      page.waitForURL(/\/w\/[^/]+\/parts$/, { timeout: 60000 }),
      page.getByRole("button", { name: "Create workspace" }).click()
    ]);

    // Parts should be visible
    await expect(page.getByText("No parts yet")).not.toBeVisible();
    // Search for a known part from the fixture
    await page.getByRole("searchbox", { name: "Search parts" }).fill("NE555P");
    await expect(page.getByText("NE555P").first()).toBeVisible();

    // Extract workspace slug from URL
    const url = page.url();
    const workspaceSlug = url.match(/\/w\/([^/]+)\//)?.[1];
    expect(workspaceSlug).toBeTruthy();

    // Purchase orders page should have at least one entry
    await page.goto(`/w/${workspaceSlug}/purchase-orders`);
    await expect(page.getByRole("heading", { level: 1, name: "Purchase Orders" })).toBeVisible();
    await expect(page.getByText("No purchase orders yet")).not.toBeVisible();

    // Shopping lists page should have at least one entry
    await page.goto(`/w/${workspaceSlug}/shopping-lists`);
    await expect(page.getByRole("heading", { level: 1, name: "Shopping Lists" })).toBeVisible();
    await expect(page.getByText("No shopping lists yet")).not.toBeVisible();
  });
});
