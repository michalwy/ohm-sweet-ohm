import { expect, test } from "@playwright/test";

test.describe("parts list", () => {
  test("redirects anonymous users to sign in", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Sign in" })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("registers a user, shows an empty workspace list, and creates a workspace", async ({
    page
  }, testInfo) => {
    const email = `new-user-${testInfo.project.name}@ohmsweetohm.local`;
    const workspaceName = `Lab ${testInfo.project.name}`;

    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("New OSO User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("ohm-sweet-ohm-new-user");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Workspaces" })
    ).toBeVisible();
    await expect(page.getByText("No workspaces yet")).toBeVisible();

    await page.getByLabel("Workspace name").fill(workspaceName);
    await page.getByRole("button", { name: "Create workspace" }).click();

    await expect(page).toHaveURL(/\/w\/lab-[^/]+\/parts$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Parts" })
    ).toBeVisible();
    await expect(page.getByText("No parts yet")).toBeVisible();
  });

  test("shows seeded parts, creates a new part in a modal, and edits through a modal", async ({
    page
  }, testInfo) => {
    const catalogNumber = `ATMEGA328P-PU-${testInfo.project.name}`;
    const updatedCatalogNumber = `${catalogNumber}-A`;
    const updatedManufacturer = "Microchip";

    await page.goto("/");
    await page.getByLabel("Email").fill("owner@ohmsweetohm.local");
    await page.getByLabel("Password").fill("ohm-sweet-ohm-owner");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Workspaces" })
    ).toBeVisible();
    await page.getByRole("link", { name: "Open" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Parts" })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/w\/default\/parts$/);
    const seededPartRow = page.getByRole("row", {
      name: /NE555P.*Texas Instruments/
    });
    await expect(seededPartRow).toBeVisible();
    await expect(seededPartRow).toContainText("NE555P");
    await expect(seededPartRow).toContainText("Texas Instruments");

    await page.getByRole("button", { name: "Add part" }).click();
    const addPartDialog = page.getByRole("dialog", { name: "Add part" });
    await expect(addPartDialog).toBeVisible();
    await addPartDialog.getByLabel("Catalog number").fill(catalogNumber);
    await addPartDialog.getByLabel("Manufacturer").fill("Microchip Technology");
    await page.getByRole("button", { name: "Create part" }).click();

    await expect(page.getByText("Part created.")).toBeVisible();
    const createdPartRow = page.getByRole("row", {
      name: new RegExp(`${catalogNumber}.*Microchip Technology`)
    });

    await expect(createdPartRow).toBeVisible();
    await expect(createdPartRow).toContainText("Microchip Technology");

    await createdPartRow.getByRole("button", { name: "Edit" }).click();
    const editPartDialog = page.getByRole("dialog", { name: "Edit part" });
    await expect(editPartDialog).toBeVisible();
    await expect(editPartDialog.getByLabel("Catalog number")).toHaveValue(
      catalogNumber
    );
    await expect(editPartDialog.getByLabel("Manufacturer")).toHaveValue(
      "Microchip Technology"
    );
    await editPartDialog.getByLabel("Catalog number").fill(updatedCatalogNumber);
    await editPartDialog.getByLabel("Manufacturer").fill(updatedManufacturer);
    await editPartDialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByText("Part updated.")).toBeVisible();
    await expect(
      page.getByRole("row", {
        name: new RegExp(`${updatedCatalogNumber}.*${updatedManufacturer}`)
      })
    ).toBeVisible();
  });
});
