import { expect, test } from "@playwright/test";
import { Pool } from "pg";

test.describe("locations", () => {
  test("blocks archiving when location still has stock", async ({ page }, testInfo) => {
    const suffix = `${testInfo.project.name}-${testInfo.retry}`.replace(/[^a-zA-Z0-9]/g, "-");
    const locationName = `Archive Block ${suffix}`;

    await page.goto("/");
    await page.getByLabel("Email").fill("owner@ohmsweetohm.local");
    await page.getByLabel("Password").fill("ohm-sweet-ohm-owner");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/(workspaces|w\/default\/parts)$/);

    const openWorkspaceLink = page.getByRole("link", { name: "Open" });
    if (await openWorkspaceLink.count()) {
      await openWorkspaceLink.click();
    }

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
