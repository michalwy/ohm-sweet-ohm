import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { signInAsOwner } from "./helpers";

test.describe("locations", () => {
  test("blocks archiving when location still has stock", async ({ page }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`.replace(/[^a-zA-Z0-9]/g, "-");
    const locationName = `Archive Block ${suffix}`;

    await signInAsOwner(page);

    await page.goto("/w/default/locations");
    await expect(page).toHaveURL(/\/w\/default\/locations$/);

    await page.getByRole("button", { name: "Add location" }).click();
    const addDialog = page.getByRole("dialog", { name: "Add location" });
    await expect(addDialog).toBeVisible();
    await addDialog.getByLabel("Name").fill(locationName);
    await addDialog.getByRole("button", { name: "Create location" }).click();

    const locationNode = page
      .locator("li")
      .filter({ has: page.locator("p", { hasText: new RegExp(`^${escapeRegex(locationName)}$`) }) })
      .first();
    await expect(locationNode).toBeVisible();

    await seedStockInLocationByName(locationName);

    await locationNode.getByRole("button", { name: "Edit" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit location" });
    await expect(editDialog).toBeVisible();
    await editDialog.getByRole("checkbox", { name: "Archived" }).check();
    await editDialog.getByRole("button", { name: "Save changes" }).click();

    await expect(
      editDialog.getByText(
        "This location still has stock. Move or adjust stock to zero before archiving."
      )
    ).toBeVisible();
  });

  test("creates a location, edits it, and shows it in the tree", async ({ page }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`.replace(/[^a-zA-Z0-9]/g, "-");
    const locationName = `Shelf A ${suffix}`;
    const updatedName = `Shelf A Updated ${suffix}`;

    await signInAsOwner(page);
    await page.goto("/w/default/locations");
    await expect(page).toHaveURL(/\/w\/default\/locations$/);

    await page.getByRole("button", { name: "Add location" }).click();
    const addDialog = page.getByRole("dialog", { name: "Add location" });
    await expect(addDialog).toBeVisible();
    await addDialog.getByLabel("Name").fill(locationName);
    await addDialog.getByRole("button", { name: "Create location" }).click();
    await expect(addDialog).not.toBeVisible();

    const locationNode = page
      .locator("li")
      .filter({ has: page.locator("p", { hasText: new RegExp(`^${escapeRegex(locationName)}$`) }) })
      .first();
    await expect(locationNode).toBeVisible();

    await locationNode.getByRole("button", { name: "Edit" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit location" });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByLabel("Name")).toHaveValue(locationName);

    await editDialog.getByLabel("Name").fill(updatedName);
    await editDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(editDialog).not.toBeVisible();

    await expect(
      page.locator("p", { hasText: new RegExp(`^${escapeRegex(updatedName)}$`) })
    ).toBeVisible();
  });

  test("prevents creating a location with a duplicate name", async ({ page }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`.replace(/[^a-zA-Z0-9]/g, "-");
    const locationName = `Duplicate Test ${suffix}`;

    await signInAsOwner(page);
    await page.goto("/w/default/locations");

    await page.getByRole("button", { name: "Add location" }).click();
    const addDialog = page.getByRole("dialog", { name: "Add location" });
    await addDialog.getByLabel("Name").fill(locationName);
    await addDialog.getByRole("button", { name: "Create location" }).click();
    await expect(addDialog).not.toBeVisible();

    await page.getByRole("button", { name: "Add location" }).click();
    await expect(addDialog).toBeVisible();
    await addDialog.getByLabel("Name").fill(locationName);
    await addDialog.getByRole("button", { name: "Create location" }).click();

    await expect(addDialog.getByText("A sibling location with this name already exists.")).toBeVisible();
  });

  test("creates a child location and shows it nested under the parent", async ({ page }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`.replace(/[^a-zA-Z0-9]/g, "-");
    const parentName = `Cabinet ${suffix}`;
    const childName = `Drawer 1 ${suffix}`;

    await signInAsOwner(page);
    await page.goto("/w/default/locations");

    await page.getByRole("button", { name: "Add location" }).click();
    const addDialog = page.getByRole("dialog", { name: "Add location" });
    await addDialog.getByLabel("Name").fill(parentName);
    await addDialog.getByRole("button", { name: "Create location" }).click();
    await expect(addDialog).not.toBeVisible();

    const parentNode = page
      .locator("li")
      .filter({ has: page.locator("p", { hasText: new RegExp(`^${escapeRegex(parentName)}$`) }) })
      .first();
    await parentNode.getByRole("button", { name: "Add child" }).click();

    const childDialog = page.getByRole("dialog", { name: "Add location" });
    await expect(childDialog).toBeVisible();
    await childDialog.getByLabel("Name").fill(childName);
    await childDialog.getByRole("button", { name: "Create location" }).click();
    await expect(childDialog).not.toBeVisible();

    await parentNode.getByRole("button", { name: /Expand/ }).click();
    await expect(
      page.locator("p", { hasText: new RegExp(`^${escapeRegex(childName)}$`) })
    ).toBeVisible();
  });

  test("deletes a location without stock", async ({ page }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`.replace(/[^a-zA-Z0-9]/g, "-");
    const locationName = `To Delete ${suffix}`;

    await signInAsOwner(page);
    await page.goto("/w/default/locations");

    await page.getByRole("button", { name: "Add location" }).click();
    const addDialog = page.getByRole("dialog", { name: "Add location" });
    await addDialog.getByLabel("Name").fill(locationName);
    await addDialog.getByRole("button", { name: "Create location" }).click();
    await expect(addDialog).not.toBeVisible();

    const locationNode = page
      .locator("li")
      .filter({ has: page.locator("p", { hasText: new RegExp(`^${escapeRegex(locationName)}$`) }) })
      .first();
    await locationNode.getByRole("button", { name: "Delete" }).click();

    await expect(page.getByText("This cannot be undone.")).toBeVisible();
    const confirmDialog = page.locator("dialog[open]").filter({ hasText: "This cannot be undone." });
    await confirmDialog.getByRole("button", { name: "Delete" }).click();

    await expect(
      page.locator("p", { hasText: new RegExp(`^${escapeRegex(locationName)}$`) })
    ).not.toBeVisible();
  });

  test("prevents deleting a location that has children", async ({ page }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`.replace(/[^a-zA-Z0-9]/g, "-");
    const parentName = `Has Children ${suffix}`;
    const childName = `Child Of ${suffix}`;

    await signInAsOwner(page);
    await page.goto("/w/default/locations");

    await page.getByRole("button", { name: "Add location" }).click();
    const addDialog = page.getByRole("dialog", { name: "Add location" });
    await addDialog.getByLabel("Name").fill(parentName);
    await addDialog.getByRole("button", { name: "Create location" }).click();
    await expect(addDialog).not.toBeVisible();

    const parentNode = page
      .locator("li")
      .filter({ has: page.locator("p", { hasText: new RegExp(`^${escapeRegex(parentName)}$`) }) })
      .first();
    await parentNode.getByRole("button", { name: "Add child" }).click();

    const childDialog = page.getByRole("dialog", { name: "Add location" });
    await childDialog.getByLabel("Name").fill(childName);
    await childDialog.getByRole("button", { name: "Create location" }).click();
    await expect(childDialog).not.toBeVisible();

    await parentNode.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("This cannot be undone.")).toBeVisible();
    const confirmDialog = page.locator("dialog[open]").filter({ hasText: "This cannot be undone." });
    await confirmDialog.getByRole("button", { name: "Delete" }).click();

    await expect(
      page.getByText("Delete child locations before deleting this location.")
    ).toBeVisible();
  });
});


async function seedStockInLocationByName(locationName: string) {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://oso:oso_e2e_password@localhost:5433/ohm_sweet_ohm_e2e?schema=public";
  const pool = new Pool({ connectionString });

  try {
    const workspaceResult = await pool.query<{ id: string }>(
      `SELECT id FROM "Workspace" WHERE slug = 'default' LIMIT 1`
    );
    const workspaceId = workspaceResult.rows[0]?.id;

    if (!workspaceId) {
      throw new Error("e2e_workspace_setup_failed");
    }

    const locationResult = await pool.query<{ id: string }>(
      `SELECT id FROM "StorageLocation" WHERE "workspaceId" = $1 AND name = $2 LIMIT 1`,
      [workspaceId, locationName]
    );
    const locationId = locationResult.rows[0]?.id;

    if (!locationId) {
      throw new Error("e2e_location_setup_failed");
    }

    const partResult = await pool.query<{ id: string }>(
      `SELECT p.id
       FROM "Part" p
       JOIN "Organization" o ON o.id = p."manufacturerId"
       WHERE p."workspaceId" = $1 AND o.name = 'Texas Instruments' AND p."catalogNumber" = 'NE555P'
       LIMIT 1`,
      [workspaceId]
    );
    const partId = partResult.rows[0]?.id;

    if (!partId) {
      throw new Error("e2e_part_setup_failed");
    }

    await pool.query(
      `INSERT INTO "InventoryEntry" (
         id,
         "workspaceId",
         "partId",
         "entryType",
         quantity,
         "toLocationId",
         note,
         "createdAt"
       )
       VALUES ($1, $2, $3, 'RECEIPT', 1, $4, $5, now())`,
      [
        `ie_e2e_archive_block_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        workspaceId,
        partId,
        locationId,
        "e2e archive block setup"
      ]
    );

    await pool.query(
      `UPDATE "Part"
       SET "currentStock" = "currentStock" + 1,
           "updatedAt" = now()
       WHERE id = $1`,
      [partId]
    );
  } finally {
    await pool.end();
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
