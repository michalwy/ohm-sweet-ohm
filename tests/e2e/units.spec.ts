import { expect, test } from "@playwright/test";

test.describe("units", () => {
  test("creates a unit, edits it, and deletes it", async ({ page }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`.replace(/[^a-zA-Z0-9]/g, "-");
    const unitName = `E2E Unit ${suffix}`;
    const unitSymbol = "e2u";

    await signIn(page);
    await page.goto("/w/default/units");
    await expect(page).toHaveURL(/\/w\/default\/units$/);
    await expect(page.getByRole("heading", { level: 1, name: "Units" })).toBeVisible();

    await page.getByRole("button", { name: "Add unit" }).click();
    const addDialog = page.getByRole("dialog", { name: "Add unit" });
    await expect(addDialog).toBeVisible();

    await addDialog.getByRole("button", { name: "Create unit" }).click();
    await expect(addDialog.getByLabel("Name").locator("..").getByText("Check the unit fields and try again.")).toBeVisible();

    await addDialog.getByLabel("Name").fill(unitName);
    await addDialog.getByLabel("Symbol").fill(unitSymbol);
    await addDialog.getByRole("button", { name: "Create unit" }).click();
    await expect(addDialog).not.toBeVisible();

    await expect(page.getByRole("status")).toContainText(`Unit created: ${unitName}`);

    const unitRow = page.getByRole("row", { name: new RegExp(escapeRegex(unitName)) });
    await expect(unitRow).toBeVisible();
    await expect(unitRow).toContainText(unitSymbol);
    await expect(unitRow).toContainText("No");

    await unitRow.getByRole("button", { name: "Edit" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit unit" });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByLabel("Name")).toHaveValue(unitName);
    await expect(editDialog.getByLabel("Symbol")).toHaveValue(unitSymbol);

    const updatedSymbol = "e2uv2";
    await editDialog.getByLabel("Symbol").fill(updatedSymbol);
    await editDialog.getByLabel("Allows fractional quantities").check();
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(editDialog).not.toBeVisible();

    await expect(page.getByRole("status")).toContainText(`Unit updated: ${unitName}`);
    await expect(page.getByRole("row", { name: new RegExp(escapeRegex(unitName)) })).toContainText(updatedSymbol);
    await expect(page.getByRole("row", { name: new RegExp(escapeRegex(unitName)) })).toContainText("Yes");

    await page.getByRole("row", { name: new RegExp(escapeRegex(unitName)) }).getByRole("button", { name: "Delete" }).click();
    const confirmDialog = page.getByRole("dialog", { name: new RegExp(`Delete.*${escapeRegex(unitName)}`) });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Delete" }).click();
    await expect(confirmDialog).not.toBeVisible();

    await expect(page.getByRole("status")).toContainText(`Unit deleted: ${unitName}`);
    await expect(page.getByRole("row", { name: new RegExp(escapeRegex(unitName)) })).not.toBeVisible();
  });

  test("prevents creating a unit with a duplicate name", async ({ page }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`.replace(/[^a-zA-Z0-9]/g, "-");
    const unitName = `Dup Unit ${suffix}`;

    await signIn(page);
    await page.goto("/w/default/units");

    await page.getByRole("button", { name: "Add unit" }).click();
    const addDialog = page.getByRole("dialog", { name: "Add unit" });
    await addDialog.getByLabel("Name").fill(unitName);
    await addDialog.getByLabel("Symbol").fill("dup1");
    await addDialog.getByRole("button", { name: "Create unit" }).click();
    await expect(addDialog).not.toBeVisible();

    await page.getByRole("button", { name: "Add unit" }).click();
    await expect(addDialog).toBeVisible();
    await addDialog.getByLabel("Name").fill(unitName);
    await addDialog.getByLabel("Symbol").fill("dup2");
    await addDialog.getByRole("button", { name: "Create unit" }).click();

    await expect(addDialog.getByText("A unit with this name already exists.")).toBeVisible();
  });

  test("prevents deleting a unit that is in use by a part", async ({ page }) => {
    await signIn(page);
    await page.goto("/w/default/units");

    const pcsRow = page.getByRole("row", { name: /Pieces/ });
    await expect(pcsRow).toBeVisible();

    await pcsRow.getByRole("button", { name: "Delete" }).click();

    const confirmDialog = page.getByRole("dialog", { name: /Delete.*Pieces/ });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Delete" }).click();

    await expect(
      page.getByText("This unit is used by parts and cannot be deleted.")
    ).toBeVisible();
  });

  test("shows seeded units", async ({ page }) => {
    await signIn(page);
    await page.goto("/w/default/units");

    await expect(page.getByRole("row", { name: /Pieces/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Meters/ })).toBeVisible();
  });
});

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill("owner@ohmsweetohm.local");
  await page.getByLabel("Password").fill("ohm-sweet-ohm-owner");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/(workspaces|w\/default\/parts)$/);

  const openWorkspaceLink = page.getByRole("link", { name: "Open" });
  if (await openWorkspaceLink.count()) {
    await openWorkspaceLink.click();
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
