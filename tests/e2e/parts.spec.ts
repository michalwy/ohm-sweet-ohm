import { expect, test } from "@playwright/test";

test.describe("parts list", () => {
  test("shows seeded parts and creates a new part", async ({
    page
  }, testInfo) => {
    const catalogNumber = `ATMEGA328P-PU-${testInfo.project.name}`;

    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Parts" })
    ).toBeVisible();
    await expect(page.getByText("NE555P")).toBeVisible();
    await expect(page.getByText("Texas Instruments")).toBeVisible();

    await page.getByLabel("Catalog number").fill(catalogNumber);
    await page.getByLabel("Manufacturer").fill("Microchip Technology");
    await page.getByRole("button", { name: "Create part" }).click();

    await expect(page.getByText("Part created.")).toBeVisible();
    const createdPartRow = page.getByRole("row").filter({
      hasText: catalogNumber
    });

    await expect(createdPartRow).toBeVisible();
    await expect(
      createdPartRow.getByRole("cell", { name: "Microchip Technology" })
    ).toBeVisible();
  });
});
