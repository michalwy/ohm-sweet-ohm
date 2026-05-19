import { expect, test } from "@playwright/test";

test.describe("parts list", () => {
  test("shows seeded parts, creates a new part in a modal, and edits inline", async ({
    page
  }, testInfo) => {
    const catalogNumber = `ATMEGA328P-PU-${testInfo.project.name}`;
    const updatedCatalogNumber = `${catalogNumber}-A`;

    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Parts" })
    ).toBeVisible();
    const seededPartRow = page.getByRole("row", {
      name: /NE555P.*Texas Instruments/
    });
    await expect(seededPartRow).toBeVisible();
    await expect(
      seededPartRow.getByRole("textbox", { name: "Catalog number" })
    ).toHaveValue("NE555P");
    await expect(
      seededPartRow.getByRole("textbox", { name: "Manufacturer" })
    ).toHaveValue("Texas Instruments");

    await page.getByRole("button", { name: "Add part" }).click();
    const addPartDialog = page.getByRole("dialog");
    await expect(addPartDialog).toBeVisible();
    await addPartDialog.getByLabel("Catalog number").fill(catalogNumber);
    await addPartDialog.getByLabel("Manufacturer").fill("Microchip Technology");
    await page.getByRole("button", { name: "Create part" }).click();

    await expect(page.getByText("Part created.")).toBeVisible();
    const createdPartRow = page.getByRole("row", {
      name: new RegExp(`${catalogNumber}.*Microchip Technology`)
    });

    await expect(createdPartRow).toBeVisible();
    await expect(
      createdPartRow.getByRole("textbox", { name: "Manufacturer" })
    ).toHaveValue("Microchip Technology");

    await createdPartRow
      .getByRole("textbox", { name: "Catalog number" })
      .fill(updatedCatalogNumber);
    await createdPartRow
      .getByRole("textbox", { name: "Catalog number" })
      .press("Enter");

    await expect(page.getByText("Part updated.")).toBeVisible();
    await expect(
      page.getByRole("row", {
        name: new RegExp(`${updatedCatalogNumber}.*Microchip Technology`)
      })
    ).toBeVisible();
  });
});
