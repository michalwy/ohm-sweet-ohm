import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { signInAsOwner } from "./helpers";

test.describe("inventory", () => {
  test("adds a receipt movement and shows updated stock in the parts list", async ({ page }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`.replace(/[^a-zA-Z0-9]/g, "-");
    const locationName = `Bin Receipt ${suffix}`;

    await signInAsOwner(page);

    await page.goto("/w/default/locations");
    await page.getByRole("button", { name: "Add location" }).click();
    const addLocationDialog = page.getByRole("dialog", { name: "Add location" });
    await addLocationDialog.getByLabel("Name").fill(locationName);
    await addLocationDialog.getByRole("button", { name: "Create location" }).click();
    await expect(addLocationDialog).not.toBeVisible();

    await page.goto("/w/default/parts");
    await expect(page.getByRole("heading", { level: 1, name: "Parts" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Stock" })).toBeVisible();

    const seededPartRow = page.locator("tr").filter({ hasText: "NE555P" }).filter({ hasText: "Texas Instruments" }).first();
    await expect(seededPartRow).toBeVisible();

    const stockBefore = await getPartStock("NE555P");

    await seededPartRow.click();
    await page.getByRole("button", { name: "Move" }).click();

    const stockDialog = page.getByRole("dialog", { name: /Stock:/ });
    await expect(stockDialog).toBeVisible();

    await stockDialog.getByLabel("Entry type").selectOption("RECEIPT");
    await stockDialog.getByLabel("Quantity").fill("5");
    await stockDialog.getByLabel("To location").selectOption({ label: locationName });
    await stockDialog.getByRole("button", { name: "Move" }).click();

    await expect(stockDialog.getByLabel("Quantity")).toHaveValue("");

    const expectedStock = stockBefore + 5;
    await expect(
      page.locator("tr").filter({ hasText: "NE555P" }).filter({ hasText: String(expectedStock) }).first()
    ).toBeVisible();
  });

  test("adds an issue movement and decrements stock", async ({ page }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`.replace(/[^a-zA-Z0-9]/g, "-");
    const locationName = `Bin Issue ${suffix}`;

    await signInAsOwner(page);
    await seedLocationWithStock(locationName, 10);

    await page.goto("/w/default/parts");
    await expect(page.getByRole("heading", { level: 1, name: "Parts" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Stock" })).toBeVisible();

    const seededPartRow = page.locator("tr").filter({ hasText: "NE555P" }).filter({ hasText: "Texas Instruments" }).first();
    await expect(seededPartRow).toBeVisible();

    const stockBefore = await getPartStock("NE555P");

    await seededPartRow.click();
    await page.getByRole("button", { name: "Move" }).click();

    const stockDialog = page.getByRole("dialog", { name: /Stock:/ });
    await expect(stockDialog).toBeVisible();

    await stockDialog.getByLabel("Entry type").selectOption("ISSUE");
    await stockDialog.getByLabel("Quantity").fill("3");
    await stockDialog.getByLabel("From location").selectOption({ label: locationName });
    await stockDialog.getByRole("button", { name: "Move" }).click();

    await expect(stockDialog.getByLabel("Quantity")).toHaveValue("");

    const expectedStock = stockBefore - 3;
    await expect(
      page.locator("tr").filter({ hasText: "NE555P" }).filter({ hasText: String(expectedStock) }).first()
    ).toBeVisible();
  });

  test("shows movement history in the details panel after adding a receipt", async ({ page }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`.replace(/[^a-zA-Z0-9]/g, "-");
    const locationName = `Bin History ${suffix}`;
    const note = `e2e-receipt-${suffix}`;

    await signInAsOwner(page);

    await page.goto("/w/default/locations");
    await page.getByRole("button", { name: "Add location" }).click();
    const addLocationDialog = page.getByRole("dialog", { name: "Add location" });
    await addLocationDialog.getByLabel("Name").fill(locationName);
    await addLocationDialog.getByRole("button", { name: "Create location" }).click();
    await expect(addLocationDialog).not.toBeVisible();

    await page.goto("/w/default/parts");
    await expect(page.getByRole("heading", { level: 1, name: "Parts" })).toBeVisible();

    const seededPartRow = page.locator("tr").filter({ hasText: "NE555P" }).filter({ hasText: "Texas Instruments" }).first();
    await expect(seededPartRow).toBeVisible();
    await seededPartRow.click();

    await page.getByRole("button", { name: "Move" }).click();
    const stockDialog = page.getByRole("dialog", { name: /Stock:/ });
    await expect(stockDialog).toBeVisible();

    await stockDialog.getByLabel("Entry type").selectOption("RECEIPT");
    await stockDialog.getByLabel("Quantity").fill("2");
    await stockDialog.getByLabel("To location").selectOption({ label: locationName });
    await stockDialog.getByLabel("Note").fill(note);
    await stockDialog.getByRole("button", { name: "Move" }).click();

    await expect(stockDialog.getByLabel("Quantity")).toHaveValue("");

    await stockDialog.getByRole("button", { name: "Close" }).last().click();
    await expect(stockDialog).not.toBeVisible();

    await expect(page.getByRole("heading", { name: "Movement history" })).toBeVisible();
    await expect(page.getByText("RECEIPT", { exact: true }).first()).toBeVisible();
    await expect(page.getByText(note, { exact: true })).toBeVisible();
  });

  test("shows per-location stock breakdown in the details panel", async ({ page }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`.replace(/[^a-zA-Z0-9]/g, "-");
    const locationName = `Bin Balance ${suffix}`;

    await signInAsOwner(page);
    await seedLocationWithStock(locationName, 7);

    await page.goto("/w/default/parts");
    await expect(page.getByRole("heading", { level: 1, name: "Parts" })).toBeVisible();

    const seededPartRow = page.locator("tr").filter({ hasText: "NE555P" }).filter({ hasText: "Texas Instruments" }).first();
    await expect(seededPartRow).toBeVisible();
    await seededPartRow.click();

    await expect(page.getByRole("heading", { name: "Locations and stock" })).toBeVisible();
    await expect(page.getByText(locationName, { exact: true })).toBeVisible();
  });
});


async function getPartStock(catalogNumber: string): Promise<number> {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://oso:oso_e2e_password@localhost:5433/ohm_sweet_ohm_e2e?schema=public";
  const pool = new Pool({ connectionString });
  try {
    const workspaceResult = await pool.query<{ id: string }>(
      `SELECT id FROM "Workspace" WHERE slug = 'default' LIMIT 1`
    );
    const workspaceId = workspaceResult.rows[0]?.id;
    if (!workspaceId) return 0;

    const result = await pool.query<{ currentStock: number }>(
      `SELECT "currentStock" FROM "Part" WHERE "workspaceId" = $1 AND "catalogNumber" = $2 LIMIT 1`,
      [workspaceId, catalogNumber]
    );
    return Number(result.rows[0]?.currentStock ?? 0);
  } finally {
    await pool.end();
  }
}

async function seedLocationWithStock(
  locationName: string,
  quantity: number
): Promise<void> {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://oso:oso_e2e_password@localhost:5433/ohm_sweet_ohm_e2e?schema=public";
  const pool = new Pool({ connectionString });

  try {
    const workspaceResult = await pool.query<{ id: string }>(
      `SELECT id FROM "Workspace" WHERE slug = 'default' LIMIT 1`
    );
    const workspaceId = workspaceResult.rows[0]?.id;
    if (!workspaceId) throw new Error("e2e_workspace_setup_failed");

    const locationId = `loc_e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    await pool.query(
      `INSERT INTO "StorageLocation" (id, "workspaceId", name, "normalizedName", "isAssignable", "isArchived", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, lower($3), true, false, now(), now())
       ON CONFLICT DO NOTHING`,
      [locationId, workspaceId, locationName]
    );

    const resolvedLocationResult = await pool.query<{ id: string }>(
      `SELECT id FROM "StorageLocation" WHERE "workspaceId" = $1 AND name = $2 LIMIT 1`,
      [workspaceId, locationName]
    );
    const resolvedLocationId = resolvedLocationResult.rows[0]?.id ?? locationId;

    const partResult = await pool.query<{ id: string }>(
      `SELECT p.id FROM "Part" p
       JOIN "Organization" o ON o.id = p."manufacturerId"
       WHERE p."workspaceId" = $1 AND o.name = 'Texas Instruments' AND p."catalogNumber" = 'NE555P'
       LIMIT 1`,
      [workspaceId]
    );
    const partId = partResult.rows[0]?.id;
    if (!partId) throw new Error("e2e_part_setup_failed");

    await pool.query(
      `INSERT INTO "InventoryEntry" (id, "workspaceId", "partId", "entryType", quantity, "toLocationId", note, "createdAt")
       VALUES ($1, $2, $3, 'RECEIPT', $4, $5, 'e2e seed', now())`,
      [
        `ie_e2e_seed_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        workspaceId,
        partId,
        quantity,
        resolvedLocationId
      ]
    );

    await pool.query(
      `UPDATE "Part" SET "currentStock" = "currentStock" + $1, "updatedAt" = now() WHERE id = $2`,
      [quantity, partId]
    );
  } finally {
    await pool.end();
  }
}
