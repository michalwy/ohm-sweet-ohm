import { expect, test } from "@playwright/test";
import { Pool } from "pg";
import { signInAsOwner } from "./helpers";

const DB_URL =
  process.env.DATABASE_URL ??
  "postgresql://oso:oso_e2e_password@localhost:5433/ohm_sweet_ohm_e2e?schema=public";

function uniqueName(base: string, info: import("@playwright/test").TestInfo) {
  return `${base} ${info.project.name} ${info.workerIndex} ${info.retry}`;
}

async function ensureSupplierOrg(name: string): Promise<string> {
  const pool = new Pool({ connectionString: DB_URL });
  try {
    const wsResult = await pool.query<{ id: string }>(
      `SELECT id FROM "Workspace" WHERE slug = 'default' LIMIT 1`
    );
    const workspaceId = wsResult.rows[0]?.id;
    if (!workspaceId) throw new Error("e2e_workspace_not_found");

    const normalized = name.trim().toLocaleLowerCase("en");
    const orgId = `org_e2e_qa_${normalized.replace(/[^a-z0-9]/g, "_").slice(0, 40)}`;

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
    const res = await pool.query<{ id: string }>(
      `SELECT id FROM "Organization" WHERE "workspaceId" = $1 AND "normalizedName" = $2`,
      [workspaceId, normalized]
    );
    return res.rows[0]?.id ?? orgId;
  } finally {
    await pool.end();
  }
}

async function ensureDraftPO(supplierName: string): Promise<{ orderId: string; supplierId: string }> {
  const pool = new Pool({ connectionString: DB_URL });
  try {
    const supplierId = await ensureSupplierOrg(supplierName);
    const wsResult = await pool.query<{ id: string }>(
      `SELECT id FROM "Workspace" WHERE slug = 'default' LIMIT 1`
    );
    const workspaceId = wsResult.rows[0]?.id;
    if (!workspaceId) throw new Error("e2e_workspace_not_found");

    const poId = `po_e2e_qa_${supplierName.replace(/[^a-z0-9]/gi, "_").toLocaleLowerCase().slice(0, 30)}`;
    await pool.query(
      `INSERT INTO "PurchaseOrder" (id, "workspaceId", "supplierId", status, "priceEntryMode", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, 'DRAFT', 'net', now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [poId, workspaceId, supplierId]
    );
    return { orderId: poId, supplierId };
  } finally {
    await pool.end();
  }
}

async function ensureShoppingList(name: string): Promise<string> {
  const pool = new Pool({ connectionString: DB_URL });
  try {
    const wsResult = await pool.query<{ id: string }>(
      `SELECT id FROM "Workspace" WHERE slug = 'default' LIMIT 1`
    );
    const workspaceId = wsResult.rows[0]?.id;
    if (!workspaceId) throw new Error("e2e_workspace_not_found");

    const slId = `sl_e2e_qa_${name.replace(/[^a-z0-9]/gi, "_").toLocaleLowerCase().slice(0, 30)}`;
    await pool.query(
      `INSERT INTO "ShoppingList" (id, "workspaceId", name, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, now(), now())
       ON CONFLICT (id) DO NOTHING`,
      [slId, workspaceId, name]
    );
    return slId;
  } finally {
    await pool.end();
  }
}

test.describe("parts list — quick-add to PO", () => {
  test("adds part to existing draft PO via row button", async ({ page }, testInfo) => {
    const supplierName = uniqueName("QA PO Supplier", testInfo);
    await ensureDraftPO(supplierName);

    await signInAsOwner(page);
    const partRow = page.locator("tr").filter({ hasText: "NE555P" }).first();
    await expect(partRow).toBeVisible();

    await partRow.getByRole("button", { name: "Add to PO" }).click();

    const dialog = page.getByRole("dialog", { name: /Add to Purchase Order/ });
    await expect(dialog).toBeVisible();

    const poSelect = dialog.getByLabel("Choose a purchase order");
    await expect(poSelect).toBeVisible();
    await expect(poSelect.locator("option")).not.toHaveCount(0);

    const quantityInput = dialog.getByLabel("Quantity");
    await quantityInput.fill("3");

    await dialog.getByRole("button", { name: "Add to PO" }).click();

    await expect(page.getByRole("status")).toHaveText("Part added to purchase order");
    await expect(dialog).not.toBeVisible();
  });

  test("creates a new PO inline and adds part via row button", async ({ page }, testInfo) => {
    const supplierName = uniqueName("QA PO New Supplier", testInfo);
    await ensureSupplierOrg(supplierName);

    await signInAsOwner(page);
    const partRow = page.locator("tr").filter({ hasText: "NE555P" }).first();
    await expect(partRow).toBeVisible();

    await partRow.getByRole("button", { name: "Add to PO" }).click();

    const dialog = page.getByRole("dialog", { name: /Add to Purchase Order/ });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Create new purchase order" }).click();

    const supplierInput = dialog.getByLabel("Choose supplier");
    await supplierInput.fill(supplierName);
    const supplierOption = dialog.getByText(supplierName, { exact: true });
    await expect(supplierOption).toBeVisible();
    await supplierOption.click();

    const quantityInput = dialog.getByLabel("Quantity");
    await quantityInput.fill("2");

    await dialog.getByRole("button", { name: "Add to PO" }).click();

    await expect(page.getByRole("status")).toHaveText("Part added to purchase order");
    await expect(dialog).not.toBeVisible();
  });

  test("adds part to PO via detail panel button", async ({ page }, testInfo) => {
    const supplierName = uniqueName("QA PO Panel Supplier", testInfo);
    await ensureDraftPO(supplierName);

    await signInAsOwner(page);
    const partRow = page.locator("tr").filter({ hasText: "NE555P" }).first();
    await partRow.click();

    const detailPanel = page.getByRole("complementary");
    await expect(detailPanel.getByRole("heading", { name: "Purchase Orders" })).toBeVisible();

    await detailPanel.getByRole("button", { name: "Add to PO" }).click();

    const dialog = page.getByRole("dialog", { name: /Add to Purchase Order/ });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Quantity").fill("1");
    await dialog.getByRole("button", { name: "Add to PO" }).click();

    await expect(page.getByRole("status")).toHaveText("Part added to purchase order");
  });
});

test.describe("parts list — quick-add to shopping list", () => {
  test("adds part to existing shopping list via row button", async ({ page }, testInfo) => {
    const listName = uniqueName("QA SL Row", testInfo);
    await ensureShoppingList(listName);

    await signInAsOwner(page);
    const partRow = page.locator("tr").filter({ hasText: "NE555P" }).first();
    await expect(partRow).toBeVisible();

    await partRow.getByRole("button", { name: "Add to shopping list" }).click();

    const dialog = page.getByRole("dialog", { name: /Add to Shopping List/ });
    await expect(dialog).toBeVisible();

    const slSelect = dialog.getByLabel("Choose a shopping list");
    await expect(slSelect).toBeVisible();
    await slSelect.selectOption({ label: listName });

    await dialog.getByLabel("Quantity").fill("5");
    await dialog.getByRole("button", { name: "Add to shopping list" }).click();

    await expect(page.getByRole("status")).toHaveText("Part added to shopping list");
    await expect(dialog).not.toBeVisible();
  });

  test("creates a new shopping list inline and adds part via row button", async ({ page }, testInfo) => {
    const newListName = uniqueName("QA SL Create", testInfo);

    await signInAsOwner(page);
    const partRow = page.locator("tr").filter({ hasText: "NE555P" }).first();
    await expect(partRow).toBeVisible();

    await partRow.getByRole("button", { name: "Add to shopping list" }).click();

    const dialog = page.getByRole("dialog", { name: /Add to Shopping List/ });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Create new shopping list" }).click();

    const nameInput = dialog.getByLabel("List name");
    await nameInput.fill(newListName);

    await dialog.getByLabel("Quantity").fill("4");
    await dialog.getByRole("button", { name: "Add to shopping list" }).click();

    await expect(page.getByRole("status")).toHaveText("Part added to shopping list");
    await expect(dialog).not.toBeVisible();
  });

  test("merges quantity when part is already on the selected shopping list", async ({ page }, testInfo) => {
    const listName = uniqueName("QA SL Merge", testInfo);
    const listId = await ensureShoppingList(listName);

    const pool = new Pool({ connectionString: DB_URL });
    try {
      const wsResult = await pool.query<{ id: string }>(
        `SELECT id FROM "Workspace" WHERE slug = 'default' LIMIT 1`
      );
      const workspaceId = wsResult.rows[0]?.id;
      const partResult = await pool.query<{ id: string }>(
        `SELECT id FROM "Part" WHERE "workspaceId" = $1 AND "catalogNumber" = 'NE555P' LIMIT 1`,
        [workspaceId]
      );
      const partId = partResult.rows[0]?.id;
      if (partId) {
        await pool.query(
          `INSERT INTO "ShoppingListItem" (id, "shoppingListId", "partId", quantity, "createdAt", "updatedAt")
           VALUES (gen_random_uuid(), $1, $2, 3, now(), now())`,
          [listId, partId]
        );
      }
    } finally {
      await pool.end();
    }

    await signInAsOwner(page);
    const partRow = page.locator("tr").filter({ hasText: "NE555P" }).first();
    await partRow.click();

    const detailPanel = page.getByRole("complementary").filter({ has: page.getByRole("button", { name: "Close" }) });
    await expect(detailPanel.getByRole("heading", { name: "Shopping Lists" })).toBeVisible();

    await detailPanel.getByRole("button", { name: "Add to shopping list" }).click();

    const dialog = page.getByRole("dialog", { name: /Add to Shopping List/ });
    await expect(dialog).toBeVisible();

    const slSelect = dialog.getByLabel("Choose a shopping list");
    await expect(slSelect).toBeVisible();
    await slSelect.selectOption({ value: listId });

    await dialog.getByLabel("Quantity").fill("2");
    await dialog.getByRole("button", { name: "Add to shopping list" }).click();

    await expect(page.getByRole("status")).toHaveText("Part added to shopping list");
  });

  test("adds part to shopping list via detail panel button", async ({ page }, testInfo) => {
    const listName = uniqueName("QA SL Panel", testInfo);
    await ensureShoppingList(listName);

    await signInAsOwner(page);
    const partRow = page.locator("tr").filter({ hasText: "1N4148W" }).first();
    await partRow.click();

    const detailPanel = page.getByRole("complementary");
    await detailPanel.getByRole("button", { name: "Add to shopping list" }).click();

    const dialog = page.getByRole("dialog", { name: /Add to Shopping List/ });
    await expect(dialog).toBeVisible();

    const slSelect = dialog.getByLabel("Choose a shopping list");
    await slSelect.selectOption({ label: listName });

    await dialog.getByLabel("Quantity").fill("1");
    await dialog.getByRole("button", { name: "Add to shopping list" }).click();

    await expect(page.getByRole("status")).toHaveText("Part added to shopping list");
  });
});
