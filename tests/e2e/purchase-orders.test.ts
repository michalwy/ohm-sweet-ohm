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

async function ensureAssignableLocation(): Promise<string> {
  const pool = new Pool({ connectionString: DB_URL });
  try {
    const wsResult = await pool.query<{ id: string }>(
      `SELECT id FROM "Workspace" WHERE slug = 'default' LIMIT 1`
    );
    const workspaceId = wsResult.rows[0]?.id;
    if (!workspaceId) throw new Error("e2e_workspace_not_found");

    const existing = await pool.query<{ name: string }>(
      `SELECT name FROM "StorageLocation"
       WHERE "workspaceId" = $1 AND "isAssignable" = true
         AND ("isArchived" IS NULL OR "isArchived" = false)
       LIMIT 1`,
      [workspaceId]
    );
    if (existing.rows[0]) return existing.rows[0].name;

    const locName = "E2E Receive Location";
    await pool.query(
      `INSERT INTO "StorageLocation" (id, "workspaceId", name, "normalizedName", "isAssignable", "createdAt", "updatedAt")
       VALUES ('loc_e2e_po_receive', $1, $2, $3, true, now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [workspaceId, locName, locName.toLocaleLowerCase("en")]
    );
    return locName;
  } finally {
    await pool.end();
  }
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
    const orgId = `org_e2e_po_${normalized.replace(/[^a-z0-9]/g, "_").slice(0, 40)}`;

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

test.describe("purchase orders", () => {
  test("creates a purchase order", async ({ page }, testInfo) => {
    const supplierName = uniqueName("E2E PO Supplier", testInfo);

    await ensureSupplierOrg(supplierName);

    await signInAsOwner(page);
    await page.getByRole("link", { name: "Purchase Orders" }).click();
    await expect(page).toHaveURL(/\/w\/default\/purchase-orders$/);
    await expect(page.getByRole("heading", { level: 1, name: "Purchase Orders" })).toBeVisible();

    await page.getByRole("button", { name: "New order" }).click();
    const dialog = page.getByRole("dialog", { name: "New purchase order" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Create order" }).click();
    await expect(dialog.getByText("Select a supplier.")).toBeVisible();

    await dialog.locator('select[name="supplierId"]').selectOption({ label: supplierName });
    await dialog.getByLabel("Order number").fill("PO-E2E-CREATE");
    await dialog.getByRole("button", { name: "Create order" }).click();

    await expect(page.getByRole("status")).toHaveText("Order created");
    const orderRow = page.getByRole("row", { name: new RegExp(supplierName) }).first();
    await expect(orderRow).toBeVisible();
    await expect(orderRow).toContainText("PO-E2E-CREATE");
    await expect(orderRow).toContainText("Draft");
  });

  test("adds an item to a purchase order", async ({ page }, testInfo) => {
    const supplierName = uniqueName("E2E PO Item Supplier", testInfo);

    await ensureSupplierOrg(supplierName);

    await signInAsOwner(page);
    await page.getByRole("link", { name: "Purchase Orders" }).click();
    await expect(page).toHaveURL(/\/w\/default\/purchase-orders$/);

    await page.getByRole("button", { name: "New order" }).click();
    const dialog = page.getByRole("dialog", { name: "New purchase order" });
    await dialog.locator('select[name="supplierId"]').selectOption({ label: supplierName });
    await dialog.getByRole("button", { name: "Create order" }).click();
    await expect(page.getByRole("status")).toHaveText("Order created");

    // After creation the order is auto-selected — detail panel shows immediately
    await expect(page.getByText("No items yet. Add parts to this order.")).toBeVisible();

    await page.getByRole("button", { name: "Add item" }).click();
    const itemDialog = page.getByRole("dialog", { name: "Add item" });
    await expect(itemDialog).toBeVisible();

    await itemDialog.getByRole("button", { name: "Add item" }).click();
    await expect(itemDialog.getByText("Select a part.")).toBeVisible();

    await itemDialog.getByPlaceholder("Search by catalog number or description").fill("NE555P");
    const partButton = page.locator("button").filter({ hasText: /NE555P/ }).first();
    await expect(partButton).toBeVisible();
    await partButton.click();

    await itemDialog.getByLabel("Qty ordered").fill("10");
    await itemDialog.getByLabel("Supplier SKU").fill("TI-NE555P");
    await itemDialog.getByRole("button", { name: "Add item" }).click();

    await expect(page.getByRole("status")).toHaveText("Item added");
    await expect(page.getByText("No items yet. Add parts to this order.")).not.toBeVisible();
    await expect(page.getByRole("cell", { name: "NE555P Texas Instruments", exact: true })).toBeVisible();

    const orderRow = page.getByRole("row", { name: new RegExp(supplierName) }).first();
    await expect(orderRow.getByText("1 item")).toBeVisible();
  });

  test("marks order as ordered", async ({ page }, testInfo) => {
    const supplierName = uniqueName("E2E PO Mark Supplier", testInfo);

    await ensureSupplierOrg(supplierName);

    await signInAsOwner(page);
    await page.getByRole("link", { name: "Purchase Orders" }).click();
    await expect(page).toHaveURL(/\/w\/default\/purchase-orders$/);

    await page.getByRole("button", { name: "New order" }).click();
    const dialog = page.getByRole("dialog", { name: "New purchase order" });
    await dialog.locator('select[name="supplierId"]').selectOption({ label: supplierName });
    await dialog.getByRole("button", { name: "Create order" }).click();
    await expect(page.getByRole("status")).toHaveText("Order created");

    // Order auto-selected after creation
    await expect(page.getByText("No items yet. Add parts to this order.")).toBeVisible();

    await page.getByRole("button", { name: "Add item" }).click();
    const itemDialog = page.getByRole("dialog", { name: "Add item" });
    await itemDialog.getByPlaceholder("Search by catalog number or description").fill("NE555P");
    const partButton = page.locator("button").filter({ hasText: /NE555P/ }).first();
    await expect(partButton).toBeVisible();
    await partButton.click();
    await itemDialog.getByLabel("Qty ordered").fill("5");
    await itemDialog.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByRole("status")).toHaveText("Item added");

    await page.getByRole("button", { name: "Mark as ordered" }).click();
    const confirmDialog = page.getByRole("dialog", { name: "Mark as ordered?" });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole("button", { name: "Confirm" }).click();

    await expect(page.getByRole("status")).toHaveText("Order marked as ordered");
    const orderRow = page.getByRole("row", { name: new RegExp(supplierName) }).first();
    await expect(orderRow.getByText("Ordered")).toBeVisible();
  });

  test("receives items", async ({ page }, testInfo) => {
    const supplierName = uniqueName("E2E PO Receive Supplier", testInfo);

    await ensureSupplierOrg(supplierName);
    const locationName = await ensureAssignableLocation();

    await signInAsOwner(page);
    await page.getByRole("link", { name: "Purchase Orders" }).click();
    await expect(page).toHaveURL(/\/w\/default\/purchase-orders$/);

    await page.getByRole("button", { name: "New order" }).click();
    const dialog = page.getByRole("dialog", { name: "New purchase order" });
    await dialog.locator('select[name="supplierId"]').selectOption({ label: supplierName });
    await dialog.getByRole("button", { name: "Create order" }).click();
    await expect(page.getByRole("status")).toHaveText("Order created");

    await expect(page.getByText("No items yet. Add parts to this order.")).toBeVisible();

    await page.getByRole("button", { name: "Add item" }).click();
    const itemDialog = page.getByRole("dialog", { name: "Add item" });
    await itemDialog.getByPlaceholder("Search by catalog number or description").fill("NE555P");
    const partButton = page.locator("button").filter({ hasText: /NE555P/ }).first();
    await expect(partButton).toBeVisible();
    await partButton.click();
    await itemDialog.getByLabel("Qty ordered").fill("8");
    await itemDialog.getByRole("button", { name: "Add item" }).click();
    await expect(page.getByRole("status")).toHaveText("Item added");

    await page.getByRole("button", { name: "Mark as ordered" }).click();
    const confirmDialog = page.getByRole("dialog", { name: "Mark as ordered?" });
    await confirmDialog.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("status")).toHaveText("Order marked as ordered");

    await page.getByRole("button", { name: "Receive items" }).click();
    const receiveDialog = page.getByRole("dialog", { name: "Receive items" });
    await expect(receiveDialog).toBeVisible();

    const locationSelect = receiveDialog.locator("select").first();
    await locationSelect.selectOption({ label: locationName });

    await receiveDialog.getByRole("button", { name: "Receive items" }).click();
    await expect(page.getByRole("status")).toHaveText("Items received");

    const orderRow = page.getByRole("row", { name: new RegExp(supplierName) }).first();
    await expect(orderRow.getByText("Received")).toBeVisible();
  });

  test("edits and deletes a draft purchase order", async ({ page }, testInfo) => {
    const supplierName = uniqueName("E2E PO Delete Supplier", testInfo);

    await ensureSupplierOrg(supplierName);

    await signInAsOwner(page);
    await page.getByRole("link", { name: "Purchase Orders" }).click();
    await expect(page).toHaveURL(/\/w\/default\/purchase-orders$/);

    await page.getByRole("button", { name: "New order" }).click();
    const dialog = page.getByRole("dialog", { name: "New purchase order" });
    await dialog.locator('select[name="supplierId"]').selectOption({ label: supplierName });
    await dialog.getByLabel("Order number").fill("PO-DEL-001");
    await dialog.getByRole("button", { name: "Create order" }).click();
    await expect(page.getByRole("status")).toHaveText("Order created");

    const orderRow = page.getByRole("row", { name: /PO-DEL-001/ }).first();
    await orderRow.getByRole("button", { name: "Edit" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit purchase order" });
    await expect(editDialog).toBeVisible();
    await expect(editDialog.getByLabel("Order number")).toHaveValue("PO-DEL-001");
    await editDialog.getByLabel("Order number").fill("PO-DEL-002");
    await editDialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("status")).toHaveText("Order updated");
    await expect(page.getByRole("cell", { name: "PO-DEL-002" }).first()).toBeVisible();

    const updatedRow = page.getByRole("row", { name: /PO-DEL-002/ }).first();
    await updatedRow.getByRole("button", { name: "Delete" }).click();

    const deleteDialog = page.locator("dialog[open]").filter({ hasText: "Only draft orders can be deleted." });
    await expect(deleteDialog).toBeVisible();
    await deleteDialog.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("cell", { name: "PO-DEL-002" }).first()).toBeVisible();

    await updatedRow.getByRole("button", { name: "Delete" }).click();
    await page.locator("dialog[open]").filter({ hasText: "Only draft orders can be deleted." }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("status")).toHaveText("Order deleted");
  });
});
