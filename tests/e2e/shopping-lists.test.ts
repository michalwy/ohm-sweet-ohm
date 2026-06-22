import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { signInAsOwner } from "./helpers";

const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://oso:oso_e2e_password@localhost:5433/ohm_sweet_ohm_e2e?schema=public";

function uniqueName(base: string, info: import("@playwright/test").TestInfo) {
  return `${base} ${info.project.name} ${info.workerIndex} ${info.retry}`;
}

async function ensureSupplierOrg(name: string) {
  const pool = new Pool({ connectionString: DB_URL });
  try {
    const wsResult = await pool.query<{ id: string }>(
      `SELECT id FROM "Workspace" WHERE slug = 'default' LIMIT 1`
    );
    const workspaceId = wsResult.rows[0]?.id;
    if (!workspaceId) throw new Error("e2e_workspace_not_found");

    const normalized = name.trim().toLocaleLowerCase("en");
    const orgId = `org_e2e_sl_${normalized.replace(/[^a-z0-9]/g, "_").slice(0, 40)}`;

    await pool.query(
      `INSERT INTO "Organization" (id, "workspaceId", name, "normalizedName", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, now(), now())
       ON CONFLICT ("workspaceId", "normalizedName") DO NOTHING`,
      [orgId, workspaceId, name, normalized]
    );
    await pool.query(
      `INSERT INTO "OrganizationRole" ("organizationId", role, "createdAt")
       VALUES ($1, 'supplier', now())
       ON CONFLICT ("organizationId", role) DO NOTHING`,
      [orgId]
    );
  } finally {
    await pool.end();
  }
}

test.describe("shopping lists", () => {
  test("creates a shopping list", async ({ page }, testInfo) => {
    const listName = uniqueName("E2E List", testInfo);

    await signInAsOwner(page);
    await page.goto("/w/default/shopping-lists");
    await expect(page.getByRole("heading", { level: 1, name: "Shopping Lists" })).toBeVisible();

    await page.getByRole("button", { name: "New list" }).click();
    const dialog = page.getByRole("dialog", { name: "New shopping list" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Create list" }).click();
    await expect(dialog.getByText("Enter a name.")).toBeVisible();

    await dialog.getByLabel("Name").fill(listName);
    await dialog.getByLabel("Description").fill("My test list notes");
    await dialog.getByRole("button", { name: "Create list" }).click();

    await expect(page.getByRole("status")).toHaveText("List created");
    // Reload to get a fresh server-rendered page that includes the new list
    await page.reload();
    const listRow = page.getByRole("button", { name: new RegExp(listName) }).first();
    await expect(listRow).toBeVisible();
    await expect(listRow).toContainText("My test list notes");
  });

  test("adds an item to a shopping list", async ({ page }, testInfo) => {
    const listName = uniqueName("E2E Item List", testInfo);

    await signInAsOwner(page);
    await page.goto("/w/default/shopping-lists");

    await page.getByRole("button", { name: "New list" }).click();
    const dialog = page.getByRole("dialog", { name: "New shopping list" });
    await dialog.getByLabel("Name").fill(listName);
    await dialog.getByRole("button", { name: "Create list" }).click();
    await expect(page.getByRole("status")).toHaveText("List created");

    const listRow = page.getByRole("button", { name: new RegExp(listName) });
    await listRow.click();

    await expect(page.getByText("No items yet")).toBeVisible();

    await page.getByRole("button", { name: "Add item" }).click();
    const itemDialog = page.getByRole("dialog", { name: "Add item" });
    await expect(itemDialog).toBeVisible();

    await itemDialog.getByRole("button", { name: "Add item" }).click();
    await expect(itemDialog.getByText("Select a part.")).toBeVisible();

    await itemDialog.getByPlaceholder("Search by catalog number or description").fill("NE555P");
    const partButton = page.locator("button").filter({ hasText: /NE555P/ }).first();
    await expect(partButton).toBeVisible();
    await partButton.click();

    await itemDialog.getByLabel("Quantity").fill("5");
    await itemDialog.getByRole("button", { name: "Add item" }).click();

    await expect(page.getByRole("status")).toHaveText("Item added");
    await expect(page.getByText("No items yet")).not.toBeVisible();
    await expect(page.getByRole("cell", { name: "NE555P Texas Instruments", exact: true })).toBeVisible();
    await expect(listRow.getByText("1")).toBeVisible();
  });

  test("converts selected items to a new purchase order", async ({ page }, testInfo) => {
    const listName = uniqueName("E2E Convert List", testInfo);
    const supplierName = uniqueName("E2E SL Supplier", testInfo);

    await ensureSupplierOrg(supplierName);

    await signInAsOwner(page);
    await page.goto("/w/default/shopping-lists");

    await page.getByRole("button", { name: "New list" }).click();
    const listDialog = page.getByRole("dialog", { name: "New shopping list" });
    await listDialog.getByLabel("Name").fill(listName);
    await listDialog.getByRole("button", { name: "Create list" }).click();
    await expect(page.getByRole("status")).toHaveText("List created");

    const listRow = page.getByRole("button", { name: new RegExp(listName) }).first();
    await listRow.click();

    await page.getByRole("button", { name: "Add item" }).click();
    const itemDialog = page.getByRole("dialog", { name: "Add item" });
    await itemDialog.getByPlaceholder("Search by catalog number or description").fill("NE555P");
    const partButton = page.locator("button").filter({ hasText: /NE555P/ }).first();
    await expect(partButton).toBeVisible();
    await partButton.click();
    await itemDialog.getByLabel("Quantity").fill("3");
    await itemDialog.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByRole("status")).toHaveText("Item added");

    await page.getByLabel(/Select NE555P/).check();

    const convertButton = page.getByRole("button", { name: /Convert to order/ });
    await expect(convertButton).toBeVisible();
    await convertButton.click();

    const convertDialog = page.getByRole("dialog", { name: "Convert to purchase order" });
    await expect(convertDialog).toBeVisible();

    // Open the Create PO dialog from within the convert dialog
    await convertDialog.getByRole("button", { name: "New order" }).click();

    const createPODialog = page.getByRole("dialog", { name: "New purchase order" });
    await expect(createPODialog).toBeVisible();

    // Validation: submit without supplier
    await createPODialog.getByRole("button", { name: "Create order" }).click();
    await expect(createPODialog.getByText("Select a supplier.")).toBeVisible();

    // Select supplier and create — triggers auto-conversion
    await createPODialog.locator('#create-po-supplier').fill(supplierName);
    await page.locator('[role="option"]').filter({ hasText: supplierName }).click();
    await createPODialog.getByRole("button", { name: "Create order" }).click();

    await expect(page.getByRole("status")).toHaveText("Items added to purchase order");
    await expect(page.getByText("On order")).toBeVisible();
  });

  test("edits and deletes a shopping list", async ({ page }, testInfo) => {
    const listName = uniqueName("E2E Delete List", testInfo);
    const updatedName = uniqueName("E2E Delete List Updated", testInfo);

    await signInAsOwner(page);
    await page.goto("/w/default/shopping-lists");

    await page.getByRole("button", { name: "New list" }).click();
    const dialog = page.getByRole("dialog", { name: "New shopping list" });
    await dialog.getByLabel("Name").fill(listName);
    await dialog.getByRole("button", { name: "Create list" }).click();
    await expect(page.getByRole("status")).toHaveText("List created");

    const listRow = page.getByRole("button", { name: new RegExp(listName) });
    await listRow.getByRole("button", { name: "Edit" }).click();

    const editDialog = page.getByRole("dialog", { name: "Edit shopping list" });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByLabel("Name")).toHaveValue(listName);
    await editDialog.getByLabel("Name").fill(updatedName);
    await editDialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("status")).toHaveText("List updated");
    await expect(page.getByRole("cell", { name: updatedName })).toBeVisible();

    const updatedRow = page.getByRole("button", { name: new RegExp(updatedName) });
    await updatedRow.getByRole("button", { name: "Delete" }).click();

    const deleteDialog = page.locator("dialog[open]").filter({ hasText: "This cannot be undone." });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("cell", { name: updatedName })).toBeVisible();

    await updatedRow.getByRole("button", { name: "Delete" }).click();
    await page.locator("dialog[open]").filter({ hasText: "This cannot be undone." }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("status")).toHaveText("List deleted");
    await expect(page.getByRole("cell", { name: updatedName })).toHaveCount(0);
  });

  test("adds multiple items to a shopping list via part picker", async ({ page }, testInfo) => {
    const listName = uniqueName("E2E SL MultiAdd", testInfo);

    await signInAsOwner(page);
    await page.goto("/w/default/shopping-lists");

    // Create list
    await page.getByRole("button", { name: "New list" }).click();
    const dialog = page.getByRole("dialog", { name: "New shopping list" });
    await dialog.getByLabel("Name").fill(listName);
    await dialog.getByRole("button", { name: "Create list" }).click();
    await expect(page.getByRole("status")).toHaveText("List created");

    // Select the new list
    const listRow = page.getByRole("button", { name: new RegExp(listName) });
    await listRow.click();
    await expect(page.getByText("No items yet")).toBeVisible();

    // Open multi-add picker
    await page.getByRole("button", { name: "Add multiple items" }).click();
    const pickerDialog = page.getByRole("dialog", { name: "Add multiple items" });
    await expect(pickerDialog).toBeVisible();

    // Wait for parts and select both
    await expect(pickerDialog.getByRole("checkbox", { name: "NE555P" })).toBeVisible({ timeout: 10000 });
    await pickerDialog.getByRole("checkbox", { name: "NE555P" }).check();
    await pickerDialog.getByRole("checkbox", { name: "1N4148W" }).check();

    // Move to quantities step
    await pickerDialog.getByRole("button", { name: /Set quantities/ }).click();

    // Step 2 — quantities
    const qtyDialog = page.getByRole("dialog", { name: "Set quantities" });
    await expect(qtyDialog).toBeVisible();
    await expect(qtyDialog.getByText("NE555P")).toBeVisible();
    await expect(qtyDialog.getByText("1N4148W")).toBeVisible();

    // Set quantities
    const ne555pRow = qtyDialog.locator("tr").filter({ hasText: "NE555P" });
    await ne555pRow.getByRole("spinbutton").fill("10");
    const diodeRow = qtyDialog.locator("tr").filter({ hasText: "1N4148W" });
    await diodeRow.getByRole("spinbutton").fill("20");

    await qtyDialog.getByRole("button", { name: /Add 2 items/ }).click();

    await expect(page.getByRole("status")).toHaveText("Item added");
    // Both parts should appear in the list
    await expect(page.getByRole("cell", { name: /NE555P/ }).first()).toBeVisible();
    await expect(page.getByRole("cell", { name: /1N4148W/ }).first()).toBeVisible();
  });

  test("multi-add merges quantity when part already on shopping list", async ({ page }, testInfo) => {
    const listName = uniqueName("E2E SL Merge", testInfo);

    await signInAsOwner(page);
    await page.goto("/w/default/shopping-lists");

    // Create list
    await page.getByRole("button", { name: "New list" }).click();
    const dialog = page.getByRole("dialog", { name: "New shopping list" });
    await dialog.getByLabel("Name").fill(listName);
    await dialog.getByRole("button", { name: "Create list" }).click();
    await expect(page.getByRole("status")).toHaveText("List created");

    const listRow = page.getByRole("button", { name: new RegExp(listName) });
    await listRow.click();
    await expect(page.getByText("No items yet")).toBeVisible();

    // Add NE555P via single-add (qty=2)
    await page.getByRole("button", { name: "Add item" }).click();
    const itemDialog = page.getByRole("dialog", { name: "Add item" });
    await itemDialog.getByPlaceholder("Search by catalog number or description").fill("NE555P");
    const partButton = page.locator("button").filter({ hasText: /NE555P/ }).first();
    await expect(partButton).toBeVisible();
    await partButton.click();
    await itemDialog.getByLabel("Quantity").fill("2");
    await itemDialog.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByRole("status")).toHaveText("Item added");
    await expect(page.getByRole("cell", { name: /NE555P/ }).first()).toBeVisible();

    // Now multi-add NE555P again (qty=3) — should merge to 5
    await page.getByRole("button", { name: "Add multiple items" }).click();
    const pickerDialog = page.getByRole("dialog", { name: "Add multiple items" });
    await expect(pickerDialog.getByRole("checkbox", { name: "NE555P" })).toBeVisible({ timeout: 10000 });
    // NE555P shows "Already on list" badge but is still selectable
    await pickerDialog.getByRole("checkbox", { name: "NE555P" }).check();
    await pickerDialog.getByRole("button", { name: /Set quantities/ }).click();

    const qtyDialog = page.getByRole("dialog", { name: "Set quantities" });
    await expect(qtyDialog).toBeVisible();
    const ne555pRow = qtyDialog.locator("tr").filter({ hasText: "NE555P" });
    await ne555pRow.getByRole("spinbutton").fill("3");
    await qtyDialog.getByRole("button", { name: /Add/ }).click();
    await expect(page.getByRole("status")).toHaveText("Item added");

    // Only one row for NE555P (no duplicate), qty should be 5
    await expect(page.getByRole("cell", { name: /NE555P Texas Instruments/ })).toHaveCount(1);
    const ne555pMergeRow = page.locator("tr").filter({ has: page.getByRole("cell", { name: /NE555P Texas Instruments/ }) });
    await expect(ne555pMergeRow.locator("td").nth(2)).toHaveText("5");
  });
});
