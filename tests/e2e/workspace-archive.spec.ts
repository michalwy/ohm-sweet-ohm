import { expect, test, type Page } from "@playwright/test";

async function signUpFreshUser(page: Page, email: string) {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Archive Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("ohm-sweet-ohm-archive-test");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Workspaces" })).toBeVisible();
}

async function createWorkspace(page: Page, name: string) {
  await page.getByLabel("Workspace name").fill(name);
  await Promise.all([
    page.waitForURL(/\/w\/[^/]+\/parts$/, { timeout: 15000 }),
    page.getByRole("button", { name: "Create workspace" }).click()
  ]);

  const url = page.url();
  const workspaceSlug = url.match(/\/w\/([^/]+)\//)?.[1];

  if (!workspaceSlug) {
    throw new Error("Could not extract workspace slug from URL");
  }

  return workspaceSlug;
}

test.describe("workspace archiving", () => {
  test("archive flow: workspace moves to archived section and active list is empty", async ({
    page
  }, testInfo) => {
    const slug = `${testInfo.project.name}-${testInfo.retry}-${Date.now()}`;
    const email = `archive-flow-${slug}@ohmsweetohm.local`;

    await signUpFreshUser(page, email);
    const workspaceSlug = await createWorkspace(page, `Archive Flow ${slug}`);

    // Navigate to General settings
    await page.goto(`/w/${workspaceSlug}/settings/general`);
    await expect(page.getByRole("heading", { level: 1, name: "General" })).toBeVisible();

    // Archive button should be visible for workspace owner
    await expect(page.getByRole("button", { name: "Archive workspace" })).toBeVisible();

    // Open confirmation dialog and confirm
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Archive workspace" }).click();
    await expect(page.getByRole("heading", { name: "Archive workspace?" })).toBeVisible();
    await page.getByRole("button", { name: "Archive", exact: true }).click();

    // Should redirect to /workspaces
    await page.waitForURL("/workspaces", { timeout: 10000 });
    await expect(page.getByRole("heading", { level: 1, name: "Workspaces" })).toBeVisible();

    // Active workspaces list should be empty
    await expect(page.getByText("No workspaces yet")).toBeVisible();

    // Archived workspaces section should show the archived workspace
    await expect(page.getByText("Archived workspaces")).toBeVisible();
    await expect(page.getByText(`Archive Flow ${slug}`, { exact: true })).toBeVisible();
  });

  test("restore flow: archived workspace returns to active list", async ({
    page
  }, testInfo) => {
    const slug = `${testInfo.project.name}-${testInfo.retry}-${Date.now()}`;
    const email = `restore-flow-${slug}@ohmsweetohm.local`;

    await signUpFreshUser(page, email);
    const workspaceSlug = await createWorkspace(page, `Restore Flow ${slug}`);

    // Archive the workspace
    await page.goto(`/w/${workspaceSlug}/settings/general`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Archive workspace" }).click();
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await page.waitForURL("/workspaces", { timeout: 10000 });

    // Confirm it's in the archived section
    await expect(page.getByText("Archived workspaces")).toBeVisible();
    await expect(page.getByText(`Restore Flow ${slug}`, { exact: true })).toBeVisible();

    // Restore it
    await page.getByRole("button", { name: "Restore" }).click();

    // Wait for page to reload (form POST causes navigation)
    await page.waitForURL("/workspaces", { timeout: 10000 });

    // Workspace should be back in the active list
    await expect(page.getByText(`Restore Flow ${slug}`, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Open" })).toBeVisible();

    // Archived section should be gone
    await expect(page.getByText("Archived workspaces")).not.toBeVisible();
  });

  test("archived URL redirect: navigating to archived workspace returns to /workspaces with notice", async ({
    page
  }, testInfo) => {
    const slug = `${testInfo.project.name}-${testInfo.retry}-${Date.now()}`;
    const email = `archived-url-${slug}@ohmsweetohm.local`;

    await signUpFreshUser(page, email);
    const workspaceSlug = await createWorkspace(page, `Archived URL ${slug}`);

    // Archive the workspace
    await page.goto(`/w/${workspaceSlug}/settings/general`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Archive workspace" }).click();
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await page.waitForURL("/workspaces", { timeout: 10000 });

    // Navigate directly to the archived workspace URL
    await page.goto(`/w/${workspaceSlug}/parts`);

    // Should redirect to /workspaces with the archived notice
    await page.waitForURL(/\/workspaces/, { timeout: 10000 });
    await expect(
      page.getByText("This workspace has been archived and is no longer accessible.")
    ).toBeVisible();
  });

  test("permanent delete flow: archived workspace enters deletion-in-progress state", async ({
    page
  }, testInfo) => {
    const slug = `${testInfo.project.name}-${testInfo.retry}-${Date.now()}`;
    const email = `perm-delete-${slug}@ohmsweetohm.local`;
    const workspaceName = `Perm Delete ${slug}`;

    await signUpFreshUser(page, email);
    const workspaceSlug = await createWorkspace(page, workspaceName);

    // Archive the workspace
    await page.goto(`/w/${workspaceSlug}/settings/general`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Archive workspace" }).click();
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await page.waitForURL("/workspaces", { timeout: 10000 });

    // Verify workspace is in the archived section with action buttons
    await expect(page.getByText("Archived workspaces")).toBeVisible();
    await expect(page.getByText(workspaceName, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Permanently delete" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Restore" })).toBeVisible();

    // Open the permanent delete dialog
    await page.getByRole("button", { name: "Permanently delete" }).click();
    await expect(page.getByRole("heading", { name: "Permanently delete workspace?" })).toBeVisible();

    // Delete button should be disabled with empty input
    await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();

    // Type the workspace name to enable the delete button
    await page.getByLabel("Type the workspace name to confirm:").fill(workspaceName);
    await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeEnabled();

    // Confirm deletion
    await page.getByRole("button", { name: "Delete", exact: true }).click();

    // Wait for the page to reload
    await page.waitForURL("/workspaces", { timeout: 10000 });

    // Workspace should still appear in the archived section with "Deletion in progress"
    await expect(page.getByText("Archived workspaces")).toBeVisible();
    await expect(page.getByText(workspaceName, { exact: true })).toBeVisible();
    await expect(page.getByText("Deletion in progress")).toBeVisible();

    // Action buttons should be gone
    await expect(page.getByRole("button", { name: "Permanently delete" })).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Restore" })).not.toBeVisible();
  });
});
