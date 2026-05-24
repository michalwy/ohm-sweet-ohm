import { expect, test } from "@playwright/test";
import { Pool } from "pg";

test.describe("parts list", () => {
  test("redirects anonymous users to sign in", async ({ page }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", { level: 1, name: "Sign in" })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("registers a user, shows an empty workspace list, and creates a workspace", async ({
    page
  }, testInfo) => {
    const testRunSlug = `${testInfo.project.name}-${testInfo.retry}`;
    const email = `new-user-${testRunSlug}@ohmsweetohm.local`;
    const workspaceName = `Lab ${testRunSlug}`;

    await page.goto("/sign-up");
    await page.getByLabel("Name").fill("New OSO User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("ohm-sweet-ohm-new-user");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Workspaces" })
    ).toBeVisible();
    await expect(page.getByText("No workspaces yet")).toBeVisible();

    await page.getByLabel("Workspace name").fill(workspaceName);
    await Promise.all([
      page.waitForURL(/\/w\/lab-[^/]+\/parts$/),
      page.getByRole("button", { name: "Create workspace" }).click()
    ]);

    await expect(page).toHaveURL(/\/w\/lab-[^/]+\/parts$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Parts" })
    ).toBeVisible();
    await expect(page.getByText("No parts yet")).toBeVisible();
  });

  test("shows seeded parts, creates a new part in a modal, and edits through a modal", async ({
    page
  }, testInfo) => {
    const catalogNumber = `ATMEGA328P-PU-${testInfo.project.name}`;
    const updatedCatalogNumber = `${catalogNumber}-A`;
    const description = "8-bit microcontroller for breadboard builds";
    const updatedDescription = "Updated DIP microcontroller note";
    const updatedManufacturer = "Microchip";

    await page.goto("/");
    await page.getByLabel("Email").fill("owner@ohmsweetohm.local");
    await page.getByLabel("Password").fill("ohm-sweet-ohm-owner");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Workspaces" })
    ).toBeVisible();
    await page.getByRole("link", { name: "Open" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Parts" })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/w\/default\/parts$/);
    const seededPartRow = page.getByRole("row", {
      name: /Texas Instruments.*NE555P/
    });
    await expect(seededPartRow).toBeVisible();
    await expect(seededPartRow).toContainText("NE555P");
    await expect(seededPartRow).toContainText("Texas Instruments");
    await expect(seededPartRow).toContainText(
      "Semiconductors » Integrated circuits"
    );

    await page.getByRole("button", { name: "Add part" }).click();
    const addPartDialog = page.getByRole("dialog", { name: "Add part" });
    await expect(addPartDialog).toBeVisible();
    await addPartDialog.getByLabel("Catalog number").fill(catalogNumber);
    await addPartDialog.getByLabel("Description").fill(description);
    const createManufacturerInput = addPartDialog.getByLabel("Manufacturer");
    await createManufacturerInput.fill("tex");
    await expect(page.getByRole("option", { name: "Texas Instruments" }))
      .toBeVisible();
    await page.keyboard.press("Enter");
    await expect(createManufacturerInput).toHaveValue("Texas Instruments");
    await createManufacturerInput.fill("Microchip Technology");
    await addPartDialog.getByLabel("Primary category").click();
    await expect(page.getByRole("option", { name: /^Passives$/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Capacitors/ })).toHaveCount(
      0
    );
    await page.getByPlaceholder("Search categories").fill("integrated");
    await expect(
      addPartDialog.getByRole("button", {
        name: /Primary category.*Semiconductors » Integrated circuits/
      })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await addPartDialog.getByLabel("Secondary category").click();
    await page.getByPlaceholder("Search categories").fill("resistors");
    await expect(
      addPartDialog.getByRole("button", {
        name: /Secondary category.*Passives » Resistors/
      })
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Create part" }).click();

    await expect(page.getByRole("status")).toHaveText(
      `Part created: Microchip Technology ${catalogNumber}.`
    );
    await expect(page).toHaveURL(/\/w\/default\/parts$/);
    const createdPartRow = page.getByRole("row", {
      name: new RegExp(`Microchip Technology.*${catalogNumber}`)
    });

    await expect(createdPartRow).toBeVisible();
    await expect(createdPartRow).toContainText("Microchip Technology");
    await expect(createdPartRow).toContainText(description);
    await expect(createdPartRow).toContainText(
      "Semiconductors » Integrated circuits"
    );
    await expect(createdPartRow).toContainText("Passives » Resistors");

    await page.getByRole("button", { name: "Add part" }).click();
    await expect(addPartDialog).toBeVisible();
    await addPartDialog.getByLabel("Catalog number").fill(catalogNumber);
    await addPartDialog.getByLabel("Manufacturer").fill("Microchip Technology");
    await page.getByRole("button", { name: "Create part" }).click();

    await expect(
      page.getByText(
        "A part with this manufacturer and catalog number already exists."
      )
    ).toHaveCount(1);
    await expect(addPartDialog.getByLabel("Catalog number")).toHaveValue(
      catalogNumber
    );
    await expect(addPartDialog.getByLabel("Manufacturer")).toHaveValue(
      "Microchip Technology"
    );
    await addPartDialog.getByRole("button", { name: "Close" }).click();

    await createdPartRow.getByRole("button", { name: "Edit" }).click();
    const editPartDialog = page.getByRole("dialog", { name: "Edit part" });
    await expect(editPartDialog).toBeVisible();
    await expect(editPartDialog.getByLabel("Catalog number")).toHaveValue(
      catalogNumber
    );
    await expect(editPartDialog.getByLabel("Manufacturer")).toHaveValue(
      "Microchip Technology"
    );
    await expect(editPartDialog.getByLabel("Description")).toHaveValue(
      description
    );
    await editPartDialog.getByLabel("Catalog number").fill("NE555P");
    await editPartDialog.getByLabel("Manufacturer").fill("Texas Instruments");
    await editPartDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(
      page.getByText(
        "A part with this manufacturer and catalog number already exists."
      )
    ).toHaveCount(1);
    await expect(editPartDialog.getByLabel("Catalog number")).toHaveValue(
      "NE555P"
    );
    await expect(editPartDialog.getByLabel("Manufacturer")).toHaveValue(
      "Texas Instruments"
    );
    await editPartDialog.getByLabel("Catalog number").fill(updatedCatalogNumber);
    await editPartDialog.getByLabel("Description").fill(updatedDescription);
    const editManufacturerInput = editPartDialog.getByLabel("Manufacturer");
    await editManufacturerInput.fill("dio");
    await page.keyboard.press("Enter");
    await expect(editManufacturerInput).toHaveValue("Diodes Incorporated");
    await editManufacturerInput.fill(updatedManufacturer);
    await page.keyboard.press("Escape");
    await editPartDialog.getByLabel("Primary category").click();
    await expect(
      page.getByRole("option", { name: /Integrated circuits/ })
    ).toBeVisible();
    await expect(page.getByRole("option", { name: /Capacitors/ })).toHaveCount(
      0
    );
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("option", { name: /Integrated circuits/ })
    ).toHaveCount(0);
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("option", { name: /Integrated circuits/ })
    ).toBeVisible();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("option", { name: /Capacitors/ })).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(
      editPartDialog.getByRole("button", {
        name: /Primary category.*Passives » Capacitors/
      })
    ).toBeVisible();
    await editPartDialog.getByLabel("Secondary category").click();
    await page.getByPlaceholder("Search categories").fill("resistors");
    await expect(
      editPartDialog.getByRole("button", {
        name: /Secondary category.*Passives » Resistors/
      })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await editPartDialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("status")).toHaveText(
      `Part updated: ${updatedManufacturer} ${updatedCatalogNumber}.`
    );
    await expect(page).toHaveURL(/\/w\/default\/parts$/);
    const updatedPartRow = page.getByRole("row", {
      name: new RegExp(`${updatedManufacturer}.*${updatedCatalogNumber}`)
    });
    await expect(updatedPartRow).toBeVisible();
    await expect(updatedPartRow).toContainText(updatedDescription);
    await expect(updatedPartRow).toContainText("Passives » Capacitors");
    await expect(updatedPartRow).toContainText("Passives » Resistors");
  });

  test("manages the part category tree without delete actions", async ({
    page
  }, testInfo) => {
    const categoryName = `Sensors ${testInfo.project.name}`;
    const childName = `Temperature sensors ${testInfo.project.name}`;
    const updatedChildName = `Thermistors ${testInfo.project.name}`;

    await page.goto("/");
    await page.getByLabel("Email").fill("owner@ohmsweetohm.local");
    await page.getByLabel("Password").fill("ohm-sweet-ohm-owner");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Workspaces" })
    ).toBeVisible();
    await page.getByRole("link", { name: "Open" }).click();
    await page.goto("/w/default/part-categories");

    await expect(page).toHaveURL(/\/w\/default\/part-categories$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Part categories" })
    ).toBeVisible();
    await expect(
      page.locator("p").filter({ hasText: /^Passives$/ }).first()
    ).toBeVisible();
    await expect(
      page.locator("p").filter({ hasText: /^Capacitors$/ }).first()
    ).toBeVisible();
    await page.getByRole("button", { name: "Collapse Passives" }).click();
    await page.reload();
    await expect(
      page.locator("p").filter({ hasText: /^Capacitors$/ })
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Expand Passives" }).click();
    await expect(
      page.locator("p").filter({ hasText: /^Capacitors$/ }).first()
    ).toBeVisible();
    await expect(page.getByText("Delete")).toHaveCount(0);

    await page.getByRole("button", { name: "Add root category" }).click();
    const addCategoryDialog = page.getByRole("dialog", {
      name: "Add category"
    });
    await expect(addCategoryDialog).toBeVisible();
    await addCategoryDialog.getByLabel("Name").fill(categoryName);
    await addCategoryDialog.getByText("Organizational", { exact: true }).click();
    await addCategoryDialog
      .getByRole("button", { name: "Create category" })
      .click();

    await expect(page.getByRole("status")).toHaveText(
      `Category created: ${categoryName}.`
    );
    await expect(page).toHaveURL(/\/w\/default\/part-categories$/);
    await expect(
      page.locator("p").filter({ hasText: new RegExp(`^${categoryName}$`) })
        .first()
    ).toBeVisible();

    const categoryNode = page
      .getByTestId("part-category-node")
      .filter({
        has: page.locator("p").filter({
          hasText: new RegExp(`^${categoryName}$`)
        })
      })
      .first();
    await categoryNode.getByRole("button", { name: "Add child" }).click();
    await expect(addCategoryDialog).toBeVisible();
    await addCategoryDialog.getByLabel("Name").fill(childName);
    await addCategoryDialog
      .getByRole("button", { name: "Create category" })
      .click();

    await expect(page.getByRole("status")).toHaveText(
      `Category created: ${childName}.`
    );
    await expect(page).toHaveURL(/\/w\/default\/part-categories$/);
    await expect(
      page.locator("p").filter({ hasText: new RegExp(`^${childName}$`) })
        .first()
    ).toBeVisible();
    await expect(
      page
        .locator("p")
        .filter({ hasText: new RegExp(`^${categoryName} » ${childName}$`) })
        .first()
    ).toBeVisible();

    const childNode = page
      .getByTestId("part-category-node")
      .filter({
        has: page.locator("p").filter({
          hasText: new RegExp(`^${childName}$`)
        })
      })
      .first();
    await childNode.getByRole("button", { name: "Edit" }).click();
    const editCategoryDialog = page.getByRole("dialog", {
      name: "Edit category"
    });
    await expect(editCategoryDialog).toBeVisible();
    await editCategoryDialog.getByLabel("Name").fill(updatedChildName);
    await editCategoryDialog
      .getByRole("button", { name: "Save changes" })
      .click();

    await expect(page.getByRole("status")).toHaveText(
      `Category updated: ${updatedChildName}.`
    );
    await expect(page).toHaveURL(/\/w\/default\/part-categories$/);
    await expect(
      page.locator("p").filter({ hasText: new RegExp(`^${updatedChildName}$`) })
        .first()
    ).toBeVisible();
    await expect(
      page
        .locator("p")
        .filter({
          hasText: new RegExp(`^${categoryName} » ${updatedChildName}$`)
        })
        .first()
    ).toBeVisible();
  });

  test("manages attribute dictionary and category attribute configuration", async ({
    page
  }, testInfo) => {
    const suffix = testInfo.project.name;
    const resistanceName = `Resistance ${suffix}`;
    const mountingName = `Mounting type ${suffix}`;
    const polarizedName = `Polarized ${suffix}`;
    const overrideName = `Override marker ${suffix}`;

    await page.goto("/");
    await page.getByLabel("Email").fill("owner@ohmsweetohm.local");
    await page.getByLabel("Password").fill("ohm-sweet-ohm-owner");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Workspaces" })
    ).toBeVisible();
    await page.getByRole("link", { name: "Open" }).click();
    await page.getByRole("link", { name: "Attributes" }).click();

    await expect(page).toHaveURL(/\/w\/default\/attributes$/);
    await page.getByRole("button", { name: "Add attribute" }).click();
    const addAttributeDialog = page.getByRole("dialog", {
      name: "Add attribute"
    });
    await expect(addAttributeDialog).toBeVisible();
    await addAttributeDialog.getByLabel("Name").fill(resistanceName);
    await addAttributeDialog.getByLabel("Type").selectOption("QUANTITY");
    await addAttributeDialog.getByLabel("Base unit").fill("Ω");
    await addAttributeDialog
      .getByRole("button", { name: "Create attribute" })
      .click();

    await expect(page.getByRole("status")).toHaveText(
      `Attribute created: ${resistanceName}.`
    );
    await expect(page.getByRole("row", { name: new RegExp(resistanceName) }))
      .toBeVisible();

    await page.getByRole("button", { name: "Add attribute" }).click();
    await expect(addAttributeDialog).toBeVisible();
    await expect(addAttributeDialog.getByLabel("Name")).toHaveValue("");
    await addAttributeDialog.getByLabel("Name").fill(mountingName);
    await addAttributeDialog.getByLabel("Type").selectOption("CHOICE");
    await addAttributeDialog.getByPlaceholder("Option label").fill("SMD");
    await addAttributeDialog
      .getByRole("button", { name: "Create attribute" })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      `Attribute created: ${mountingName}.`
    );
    await expect(
      page.getByRole("row", { name: new RegExp(`${mountingName}.*SMD`) })
    )
      .toBeVisible();
    const mountingRow = page.getByRole("row", {
      name: new RegExp(`${mountingName}.*SMD`)
    });
    await mountingRow.getByRole("button", { name: "Edit" }).click();
    const editAttributeDialog = page.getByRole("dialog", {
      name: "Edit attribute"
    });
    await expect(editAttributeDialog).toBeVisible();
    await editAttributeDialog
      .getByTestId("choice-option-draft-row")
      .first()
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.getByText("Option deleted.")).toHaveCount(0);
    await editAttributeDialog.getByRole("button", { name: "Close" }).click();
    await expect(editAttributeDialog).toBeHidden();
    await expect(mountingRow).toBeVisible();

    await mountingRow.getByRole("button", { name: "Edit" }).click();
    await expect(editAttributeDialog).toBeVisible();
    await editAttributeDialog
      .getByRole("button", { name: "Save changes" })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      `Attribute updated: ${mountingName}.`
    );
    await expect(editAttributeDialog).toBeHidden();

    await page.getByRole("button", { name: "Add attribute" }).click();
    await expect(addAttributeDialog).toBeVisible();
    await addAttributeDialog.getByLabel("Name").fill(polarizedName);
    await addAttributeDialog.getByLabel("Type").selectOption("BOOLEAN");
    await addAttributeDialog
      .getByRole("button", { name: "Create attribute" })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      `Attribute created: ${polarizedName}.`
    );
    await expect(page.getByRole("row", { name: new RegExp(polarizedName) }))
      .toBeVisible();

    await page.getByRole("button", { name: "Add attribute" }).click();
    await expect(addAttributeDialog).toBeVisible();
    await addAttributeDialog.getByLabel("Name").fill(overrideName);
    await addAttributeDialog.getByLabel("Type").selectOption("TEXT");
    await addAttributeDialog
      .getByRole("button", { name: "Create attribute" })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      `Attribute created: ${overrideName}.`
    );
    await expect(page.getByRole("row", { name: new RegExp(overrideName) }))
      .toBeVisible();

    await attachTextAttributeToCategory({
      categoryName: "Passives",
      attributeName: overrideName,
      defaultValue: "Inherited marker",
      sortOrder: 90
    });

    await page.getByRole("link", { name: "Part categories" }).click();
    await expect(page).toHaveURL(/\/w\/default\/part-categories$/);

    const passivesCategoryNode = page
      .getByTestId("part-category-node")
      .filter({
        has: page.locator("p").filter({ hasText: /^Passives$/ })
      })
      .first();
    await passivesCategoryNode.getByRole("button", { name: "Add child" }).click();
    const addCategoryDialog = page.getByRole("dialog", {
      name: "Add category"
    });
    await expect(addCategoryDialog).toBeVisible();
    await addCategoryDialog.getByRole("button", { name: "Attributes" }).click();
    const inheritedNewChildDraft = addCategoryDialog
      .getByTestId("category-attribute-draft-row")
      .filter({ hasText: overrideName });
    await expect(inheritedNewChildDraft.filter({ hasText: "Inherited" }))
      .toBeVisible();
    await expect(
      inheritedNewChildDraft.getByLabel("Default value")
    ).toHaveValue("Inherited marker");
    await addCategoryDialog.getByRole("button", { name: "Close" }).click();

    const resistorCategoryNode = page
      .getByTestId("part-category-node")
      .filter({
        has: page.locator("p").filter({ hasText: /^Resistors$/ })
      })
      .first();
    await resistorCategoryNode.getByRole("button", { name: "Edit" }).click();
    const editCategoryDialog = page.getByRole("dialog", {
      name: "Edit category"
    });
    await expect(editCategoryDialog).toBeVisible();
    await editCategoryDialog.getByLabel("Name").fill("Resistors configured");
    await editCategoryDialog.getByRole("button", { name: "Attributes" }).click();
    const categoryAttributeAttachForm = editCategoryDialog.locator(
      'form:has(select[name="attributeId"])'
    );
    await categoryAttributeAttachForm
      .locator('select[name="attributeId"]')
      .selectOption({
        label: mountingName
      });
    await expect(
      categoryAttributeAttachForm.locator('select[name="defaultValue"]')
    ).toBeVisible();
    await categoryAttributeAttachForm
      .locator('select[name="defaultValue"]')
      .selectOption({
        label: "SMD"
      });
    await categoryAttributeAttachForm
      .getByRole("button", { name: "Attach" })
      .click();
    await expect(
      editCategoryDialog
        .getByTestId("category-attribute-draft-row")
        .filter({ hasText: mountingName })
    ).toBeVisible();
    await categoryAttributeAttachForm
      .locator('select[name="attributeId"]')
      .selectOption({
        label: polarizedName
      });
    await expect(
      categoryAttributeAttachForm.locator('select[name="defaultValue"]')
    ).toBeVisible();
    await categoryAttributeAttachForm
      .locator('select[name="defaultValue"]')
      .selectOption({
        label: "Yes"
      });
    await categoryAttributeAttachForm
      .getByRole("button", { name: "Attach" })
      .click();
    await expect(
      editCategoryDialog
        .getByTestId("category-attribute-draft-row")
        .filter({ hasText: polarizedName })
    ).toBeVisible();
    await categoryAttributeAttachForm
      .locator('select[name="attributeId"]')
      .selectOption({
        label: resistanceName
      });
    await categoryAttributeAttachForm.getByLabel("Sort order").fill("10");
    await categoryAttributeAttachForm.getByLabel("Default value").fill("10 k");
    await categoryAttributeAttachForm
      .getByRole("button", { name: "Attach" })
      .click();
    await expect(
      editCategoryDialog
        .getByTestId("category-attribute-draft-row")
        .filter({ hasText: resistanceName })
    ).toBeVisible();
    const overrideDraftRow = editCategoryDialog
      .getByTestId("category-attribute-draft-row")
      .filter({ hasText: overrideName });
    await expect(overrideDraftRow.filter({ hasText: "Inherited" }))
      .toBeVisible();
    await expect(
      overrideDraftRow.getByLabel("Default value")
    ).toHaveValue("Inherited marker");
    await overrideDraftRow.getByLabel("Sort order").fill("5");
    await overrideDraftRow.getByLabel("Default value").fill("Local marker");
    await expect(overrideDraftRow.filter({ hasText: "Local" })).toBeVisible();
    await expect(
      overrideDraftRow.getByLabel("Default value")
    ).toHaveValue("Local marker");
    await overrideDraftRow.getByRole("button", { name: "Detach" }).click();
    await expect(overrideDraftRow.filter({ hasText: "Inherited" }))
      .toBeVisible();
    await expect(
      overrideDraftRow.getByLabel("Default value")
    ).toHaveValue("Inherited marker");
    await editCategoryDialog.getByLabel("Value attribute").selectOption({
      label: resistanceName
    });
    await editCategoryDialog
      .getByRole("button", { name: "Save changes" })
      .click();
    await expect(editCategoryDialog).toBeHidden();
    await expect(page.getByRole("status")).toHaveText(
      "Category updated: Resistors configured."
    );
    await expect(
      page.locator("p").filter({ hasText: /^Resistors configured$/ })
    ).toBeVisible();

    await page.getByRole("link", { name: "Parts" }).click();
    await expect(page).toHaveURL(/\/w\/default\/parts$/);
    await page.getByRole("button", { name: "Add part" }).click();
    const addPartDialog = page.getByRole("dialog", { name: "Add part" });
    await expect(addPartDialog).toBeVisible();
    await addPartDialog.getByLabel("Catalog number").fill(`RC0603-${suffix}`);
    await addPartDialog.getByLabel("Manufacturer").fill("Yageo");
    await addPartDialog.getByLabel("Primary category").click();
    await page.getByPlaceholder("Search categories").fill("configured");
    const configuredCategoryOption = addPartDialog.getByRole("button", {
      name: /Primary category.*Passives » Resistors configured/
    });
    await expect(configuredCategoryOption).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(addPartDialog.getByLabel(resistanceName)).toHaveValue("10 kΩ");
    await addPartDialog.getByRole("button", { name: "Attributes" }).click();
    await addPartDialog.getByRole("button", { name: "Details" }).click();
    await expect(addPartDialog.getByLabel("Manufacturer")).toHaveValue("Yageo");
    await addPartDialog.getByLabel(resistanceName).fill("4,7 kΩ");
    await addPartDialog.getByRole("button", { name: "Create part" }).click();
    await expect(page.getByRole("status")).toHaveText(
      `Part created: Yageo RC0603-${suffix}.`
    );
    const resistorRow = page.getByRole("row", {
      name: new RegExp(`Yageo.*RC0603-${suffix}.*4.7 kΩ`)
    });
    await expect(resistorRow).toBeVisible();
    await expect(resistorRow).toContainText("Passives » Resistors configured");

    await resistorRow.getByRole("button", { name: "Edit" }).click();
    const editPartDialog = page.getByRole("dialog", { name: "Edit part" });
    await expect(editPartDialog).toBeVisible();
    await editPartDialog.getByLabel("Primary category").click();
    await page.getByPlaceholder("Search categories").fill("diodes");
    const diodesCategoryOption = editPartDialog.getByRole("button", {
      name: /Primary category.*Semiconductors » Diodes/
    });
    await expect(diodesCategoryOption).toBeVisible();
    await page.keyboard.press("Enter");
    await editPartDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toHaveText(
      `Part updated: Yageo RC0603-${suffix}.`
    );
    const updatedResistorRow = page.getByRole("row", {
      name: new RegExp(`Yageo.*RC0603-${suffix}`)
    });
    await expect(updatedResistorRow).toContainText("Semiconductors » Diodes");
    await expect(updatedResistorRow).not.toContainText("4.7 kΩ");

    await updatedResistorRow.getByRole("button", { name: "Edit" }).click();
    await expect(editPartDialog).toBeVisible();
    await editPartDialog.getByLabel("Primary category").click();
    await page.getByPlaceholder("Search categories").fill("configured");
    const restoredCategoryOption = editPartDialog.getByRole("button", {
      name: /Primary category.*Passives » Resistors configured/
    });
    await expect(restoredCategoryOption).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(editPartDialog.getByLabel(resistanceName)).toHaveValue(
      "4.7 kΩ"
    );
    await editPartDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toHaveText(
      `Part updated: Yageo RC0603-${suffix}.`
    );
    await expect(updatedResistorRow).toContainText("4.7 kΩ");
  });

  test("returns signed-in users to their last workspace", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("owner@ohmsweetohm.local");
    await page.getByLabel("Password").fill("ohm-sweet-ohm-owner");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Workspaces" })
    ).toBeVisible();
    await page.getByRole("link", { name: "Open" }).click();

    await expect(page).toHaveURL(/\/w\/default\/parts$/);
    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Sign in" })
    ).toBeVisible();
    await page.getByLabel("Email").fill("owner@ohmsweetohm.local");
    await page.getByLabel("Password").fill("ohm-sweet-ohm-owner");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/w\/default\/parts$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Parts" })
    ).toBeVisible();
  });
});

async function attachTextAttributeToCategory({
  categoryName,
  attributeName,
  defaultValue,
  sortOrder
}: {
  categoryName: string;
  attributeName: string;
  defaultValue: string;
  sortOrder: number;
}) {
  const connectionString =
    process.env.DATABASE_URL ??
    "postgresql://oso:oso_e2e_password@localhost:5433/ohm_sweet_ohm_e2e?schema=public";
  const pool = new Pool({ connectionString });

  try {
    const result = await pool.query<{
      workspace_id: string;
      category_id: string;
      attribute_id: string;
    }>(
      `
        SELECT
          workspace.id AS workspace_id,
          category.id AS category_id,
          attribute.id AS attribute_id
        FROM "Workspace" workspace
        JOIN "PartCategory" category
          ON category."workspaceId" = workspace.id
          AND category.name = $1
        JOIN "Attribute" attribute
          ON attribute."workspaceId" = workspace.id
          AND attribute.name = $2
        WHERE workspace.slug = 'default'
        LIMIT 1
      `,
      [categoryName, attributeName]
    );
    const ids = result.rows[0];

    if (!ids) {
      throw new Error("e2e_category_attribute_setup_failed");
    }

    await pool.query(
      `
        INSERT INTO "CategoryAttribute" (
          id,
          "workspaceId",
          "categoryId",
          "attributeId",
          "sortOrder",
          "defaultTextValue",
          "defaultDisplayValue",
          "createdAt",
          "updatedAt"
        )
        VALUES (
          'cp_e2e_override_marker',
          $1,
          $2,
          $3,
          $4,
          $5,
          $5,
          now(),
          now()
        )
        ON CONFLICT ("categoryId", "attributeId")
        DO UPDATE SET
          "sortOrder" = EXCLUDED."sortOrder",
          "defaultTextValue" = EXCLUDED."defaultTextValue",
          "defaultDisplayValue" = EXCLUDED."defaultDisplayValue",
          "updatedAt" = now()
      `,
      [
        ids.workspace_id,
        ids.category_id,
        ids.attribute_id,
        sortOrder,
        defaultValue
      ]
    );
  } finally {
    await pool.end();
  }
}
