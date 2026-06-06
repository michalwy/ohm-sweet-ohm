import { expect, test } from "@playwright/test";
import { Pool } from "pg";

const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://oso:oso_e2e_password@localhost:5433/ohm_sweet_ohm_e2e?schema=public";

async function signInAsOwner(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Email").fill("owner@ohmsweetohm.local");
  await page.getByLabel("Password").fill("ohm-sweet-ohm-owner");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/(workspaces|w\/default\/parts)$/, { timeout: 10000 });
  const openLink = page.getByRole("link", { name: "Open" });
  if (await openLink.count()) {
    await openLink.click();
  }
  await expect(page).toHaveURL(/\/w\/default\/parts$/);
}

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
  } finally {
    await pool.end();
  }
}

test.describe("shopping lists", () => {
  test("creates a shopping list", async ({ page }, testInfo) => {
    const listName = uniqueName("E2E List", testInfo);

    await signInAsOwner(page);
    await page.getByRole("link", { name: "Shopping Lists" }).click();
    await expect(page).toHaveURL(/\/w\/default\/shopping-lists$/);
    await expect(page.getByRole("heading", { level: 1, name: "Shopping Lists" })).toBeVisible();

    await page.getByRole("button", { name: "New list" }).click();
    const dialog = page.getByRole("dialog", { name: "New shopping list" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Create list" }).click();
    await expect(dialog.getByText("Enter a name.")).toBeVisible();

    await dialog.getByLabel("Name").fill(listName);
    await dialog.getByLabel("Notes").fill("My test list notes");
    await dialog.getByRole("button", { name: "Create list" }).click();

    await expect(page.getByRole("status")).toHaveText("List created");
    const listRow = page.getByRole("row", { name: new RegExp(listName) });
    await expect(listRow).toBeVisible();
    await expect(listRow).toContainText("My test list notes");
    await expect(listRow).toContainText("0 items");
  });

  test("adds an item to a shopping list", async ({ page }, testInfo) => {
    const listName = uniqueName("E2E Item List", testInfo);

    await signInAsOwner(page);
    await page.getByRole("link", { name: "Shopping Lists" }).click();
    await expect(page).toHaveURL(/\/w\/default\/shopping-lists$/);

    await page.getByRole("button", { name: "New list" }).click();
    const dialog = page.getByRole("dialog", { name: "New shopping list" });
    await dialog.getByLabel("Name").fill(listName);
    await dialog.getByRole("button", { name: "Create list" }).click();
    await expect(page.getByRole("status")).toHaveText("List created");

    const listRow = page.getByRole("row", { name: new RegExp(listName) });
    await listRow.getByRole("button", { name: "Open" }).click();

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
    await expect(listRow.getByText("1 item")).toBeVisible();
  });

  test("converts selected items to a purchase order", async ({ page }, testInfo) => {
    const listName = uniqueName("E2E Convert List", testInfo);
    const supplierName = uniqueName("E2E SL Supplier", testInfo);

    await ensureSupplierOrg(supplierName);

    await signInAsOwner(page);
    await page.getByRole("link", { name: "Shopping Lists" }).click();
    await expect(page).toHaveURL(/\/w\/default\/shopping-lists$/);

    await page.getByRole("button", { name: "New list" }).click();
    const dialog = page.getByRole("dialog", { name: "New shopping list" });
    await dialog.getByLabel("Name").fill(listName);
    await dialog.getByRole("button", { name: "Create list" }).click();
    await expect(page.getByRole("status")).toHaveText("List created");

    const listRow = page.getByRole("row", { name: new RegExp(listName) });
    await listRow.getByRole("button", { name: "Open" }).click();

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

    await convertDialog.getByRole("button", { name: "Convert" }).click();
    await expect(convertDialog.getByText("Select a supplier.")).toBeVisible();

    await convertDialog.locator('select[name="supplierId"]').selectOption({ label: supplierName });
    await convertDialog.getByRole("button", { name: "Convert" }).click();

    await expect(page.getByRole("status")).toHaveText("Purchase order created");
    await expect(page.getByText("On order")).toBeVisible();
  });

  test("edits and deletes a shopping list", async ({ page }, testInfo) => {
    const listName = uniqueName("E2E Delete List", testInfo);
    const updatedName = uniqueName("E2E Delete List Updated", testInfo);

    await signInAsOwner(page);
    await page.getByRole("link", { name: "Shopping Lists" }).click();

    await page.getByRole("button", { name: "New list" }).click();
    const dialog = page.getByRole("dialog", { name: "New shopping list" });
    await dialog.getByLabel("Name").fill(listName);
    await dialog.getByRole("button", { name: "Create list" }).click();
    await expect(page.getByRole("status")).toHaveText("List created");

    const listRow = page.getByRole("row", { name: new RegExp(listName) });
    await listRow.getByRole("button", { name: "Edit" }).click();

    const editDialog = page.getByRole("dialog", { name: "Edit shopping list" });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByLabel("Name")).toHaveValue(listName);
    await editDialog.getByLabel("Name").fill(updatedName);
    await editDialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("status")).toHaveText("List updated");
    await expect(page.getByRole("cell", { name: updatedName })).toBeVisible();

    const updatedRow = page.getByRole("row", { name: new RegExp(updatedName) });
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
});
