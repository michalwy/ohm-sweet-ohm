import { expect, test } from "@playwright/test";

test.describe("parts list", () => {
  test("shows seeded parts, creates a new part in a modal, and edits through a modal", async ({
    page
  }, testInfo) => {
    const catalogNumber = `ATMEGA328P-PU-${testInfo.project.name}`;
    const updatedCatalogNumber = `${catalogNumber}-A`;
    const updatedManufacturer = "Microchip";

    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Parts" })
    ).toBeVisible();
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
