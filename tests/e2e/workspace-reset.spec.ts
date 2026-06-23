import { expect, test, type Page } from "@playwright/test";

async function signUpFreshUser(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Reset Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("ohm-sweet-ohm-reset-test");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Workspaces" })).toBeVisible();
}

async function createEmptyWorkspace(page: Page, name: string): Promise<string> {
  await page.getByLabel("Workspace name").fill(name);
  await Promise.all([
    page.waitForURL(/\/w\/[^/]+\/parts$/, { timeout: 15000 }),
    page.getByRole("button", { name: "Create workspace" }).click()
  ]);

  const url = page.url();
  const workspaceSlug = url.match(/\/w\/([^/]+)\//)?.[1];
  if (!workspaceSlug) throw new Error("Could not extract workspace slug from URL");
  return workspaceSlug;
}

test.describe("workspace reset to demo data", () => {
  test("reset dialog: cancel closes without change", async ({ page }, testInfo) => {
    const slug = `${testInfo.project.name}-${testInfo.retry}-${Date.now()}`;
    const email = `reset-cancel-${slug}@ohmsweetohm.local`;

    await signUpFreshUser(page, email);
    const workspaceSlug = await createEmptyWorkspace(page, `Reset Cancel Test ${slug}`);

    await page.goto(`/w/${workspaceSlug}/settings/general`);
    await expect(page.getByRole("heading", { level: 1, name: "General" })).toBeVisible();

    // Reset button should be visible for workspace owner
    await expect(page.getByRole("button", { name: "Reset to demo data" })).toBeVisible();

    // Open dialog
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Reset to demo data" }).click();
    await expect(page.getByRole("heading", { name: "Reset workspace to demo data?" })).toBeVisible();

    // Dialog body should mention permanent deletion
    await expect(
      page.getByRole("dialog").getByText(/permanently delete/i)
    ).toBeVisible();

    // Cancel closes the dialog without navigation
    await page.getByRole("button", { name: "Cancel" }).first().click();
    await expect(
      page.getByRole("heading", { name: "Reset workspace to demo data?" })
    ).not.toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/w/${workspaceSlug}/settings/general`));
  });

  test("full reset: workspace data replaced with parts-only demo preset", async ({
    page
  }, testInfo) => {
    test.setTimeout(180000);

    const slug = `${testInfo.project.name}-${testInfo.retry}-${Date.now()}`;
    const email = `reset-full-${slug}@ohmsweetohm.local`;

    await signUpFreshUser(page, email);
    const workspaceSlug = await createEmptyWorkspace(page, `Reset Full Test ${slug}`);

    // Confirm it starts empty
    await expect(page.getByText("No parts yet")).toBeVisible();

    await page.goto(`/w/${workspaceSlug}/settings/general`);
    await page.waitForLoadState("networkidle");

    // Open reset dialog
    await page.getByRole("button", { name: "Reset to demo data" }).click();
    await expect(
      page.getByRole("heading", { name: "Reset workspace to demo data?" })
    ).toBeVisible();

    // "Parts only" is the default — confirm without changing preset
    await Promise.all([
      page.waitForURL(new RegExp(`/w/${workspaceSlug}/parts`), { timeout: 120000 }),
      page.getByRole("button", { name: "Reset workspace", exact: true }).click()
    ]);

    // Parts list should now be populated
    await expect(page.getByText("No parts yet")).not.toBeVisible();

    // A known part from the demo fixture should be findable
    await page.getByRole("searchbox", { name: "Search parts" }).fill("NE555P");
    await expect(page.getByText("NE555P").first()).toBeVisible({ timeout: 10000 });
  });
});
