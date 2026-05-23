import { expect, test } from "@playwright/test";

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
      name: /NE555P.*Texas Instruments/
    });
    await expect(seededPartRow).toBeVisible();
    await expect(seededPartRow).toContainText("NE555P");
    await expect(seededPartRow).toContainText("Texas Instruments");
    await expect(seededPartRow).toContainText(
      "Semiconductors / Integrated circuits"
    );

    await page.getByRole("button", { name: "Add part" }).click();
    const addPartDialog = page.getByRole("dialog", { name: "Add part" });
    await expect(addPartDialog).toBeVisible();
    await addPartDialog.getByLabel("Catalog number").fill(catalogNumber);
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
        name: /Primary category.*Semiconductors \/ Integrated circuits/
      })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await addPartDialog.getByLabel("Secondary category").click();
    await page.getByPlaceholder("Search categories").fill("resistors");
    await expect(
      addPartDialog.getByRole("button", {
        name: /Secondary category.*Passives \/ Resistors/
      })
    ).toBeVisible();
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Create part" }).click();

    await expect(page.getByRole("status")).toHaveText(
      `Part created: Microchip Technology ${catalogNumber}.`
    );
    await expect(page).toHaveURL(/\/w\/default\/parts$/);
    const createdPartRow = page.getByRole("row", {
      name: new RegExp(`${catalogNumber}.*Microchip Technology`)
    });

    await expect(createdPartRow).toBeVisible();
    await expect(createdPartRow).toContainText("Microchip Technology");
    await expect(createdPartRow).toContainText(
      "Semiconductors / Integrated circuits"
    );
    await expect(createdPartRow).toContainText("Passives / Resistors");

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
        name: /Primary category.*Passives \/ Capacitors/
      })
    ).toBeVisible();
    await editPartDialog.getByLabel("Secondary category").click();
    await page.getByPlaceholder("Search categories").fill("resistors");
    await expect(
      editPartDialog.getByRole("button", {
        name: /Secondary category.*Passives \/ Resistors/
      })
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await editPartDialog.getByRole("button", { name: "Save changes" }).click();

    await expect(page.getByRole("status")).toHaveText(
      `Part updated: ${updatedManufacturer} ${updatedCatalogNumber}.`
    );
    await expect(page).toHaveURL(/\/w\/default\/parts$/);
    const updatedPartRow = page.getByRole("row", {
      name: new RegExp(`${updatedCatalogNumber}.*${updatedManufacturer}`)
    });
    await expect(updatedPartRow).toBeVisible();
    await expect(updatedPartRow).toContainText("Passives / Capacitors");
    await expect(updatedPartRow).toContainText("Passives / Resistors");
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
    await expect(
      page.locator("p").filter({ hasText: /^Capacitors$/ })
    ).toHaveCount(0);
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
        .filter({ hasText: new RegExp(`^${categoryName} / ${childName}$`) })
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
          hasText: new RegExp(`^${categoryName} / ${updatedChildName}$`)
        })
        .first()
    ).toBeVisible();
  });

  test("manages parameter dictionary and category parameter configuration", async ({
    page
  }, testInfo) => {
    const suffix = testInfo.project.name;
    const resistanceName = `Resistance ${suffix}`;
    const mountingName = `Mounting type ${suffix}`;
    const polarizedName = `Polarized ${suffix}`;

    await page.goto("/");
    await page.getByLabel("Email").fill("owner@ohmsweetohm.local");
    await page.getByLabel("Password").fill("ohm-sweet-ohm-owner");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(
      page.getByRole("heading", { level: 1, name: "Workspaces" })
    ).toBeVisible();
    await page.getByRole("link", { name: "Open" }).click();
    await page.getByRole("link", { name: "Parameters" }).click();

    await expect(page).toHaveURL(/\/w\/default\/parameters$/);
    await page.getByRole("button", { name: "Add parameter" }).click();
    const addParameterDialog = page.getByRole("dialog", {
      name: "Add parameter"
    });
    await expect(addParameterDialog).toBeVisible();
    await addParameterDialog.getByLabel("Name").fill(resistanceName);
    await addParameterDialog.getByLabel("Type").selectOption("QUANTITY");
    await addParameterDialog.getByLabel("Base unit").fill("Ω");
    await addParameterDialog
      .getByRole("button", { name: "Create parameter" })
      .click();

    await expect(page.getByRole("status")).toHaveText(
      `Parameter created: ${resistanceName}.`
    );
    await expect(page.getByRole("row", { name: new RegExp(resistanceName) }))
      .toBeVisible();

    await page.getByRole("button", { name: "Add parameter" }).click();
    await expect(addParameterDialog).toBeVisible();
    await expect(addParameterDialog.getByLabel("Name")).toHaveValue("");
    await addParameterDialog.getByLabel("Name").fill(mountingName);
    await addParameterDialog.getByLabel("Type").selectOption("CHOICE");
    await addParameterDialog.getByPlaceholder("Option label").fill("SMD");
    await addParameterDialog
      .getByRole("button", { name: "Create parameter" })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      `Parameter created: ${mountingName}.`
    );
    await expect(
      page.getByRole("row", { name: new RegExp(`${mountingName}.*SMD`) })
    )
      .toBeVisible();
    const mountingRow = page.getByRole("row", {
      name: new RegExp(`${mountingName}.*SMD`)
    });
    await mountingRow.getByRole("button", { name: "Edit" }).click();
    const editParameterDialog = page.getByRole("dialog", {
      name: "Edit parameter"
    });
    await expect(editParameterDialog).toBeVisible();
    await editParameterDialog
      .getByTestId("choice-option-draft-row")
      .first()
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.getByText("Option deleted.")).toHaveCount(0);
    await editParameterDialog.getByRole("button", { name: "Close" }).click();
    await expect(editParameterDialog).toBeHidden();
    await expect(mountingRow).toBeVisible();

    await mountingRow.getByRole("button", { name: "Edit" }).click();
    await expect(editParameterDialog).toBeVisible();
    await editParameterDialog
      .getByRole("button", { name: "Save changes" })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      `Parameter updated: ${mountingName}.`
    );
    await expect(editParameterDialog).toBeHidden();

    await page.getByRole("button", { name: "Add parameter" }).click();
    await expect(addParameterDialog).toBeVisible();
    await addParameterDialog.getByLabel("Name").fill(polarizedName);
    await addParameterDialog.getByLabel("Type").selectOption("BOOLEAN");
    await addParameterDialog
      .getByRole("button", { name: "Create parameter" })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      `Parameter created: ${polarizedName}.`
    );
    await expect(page.getByRole("row", { name: new RegExp(polarizedName) }))
      .toBeVisible();

    await page.getByRole("link", { name: "Part categories" }).click();
    await expect(page).toHaveURL(/\/w\/default\/part-categories$/);
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
    await editCategoryDialog.getByRole("button", { name: "Parameters" }).click();
    const categoryParameterAttachForm = editCategoryDialog.locator(
      'form:has(select[name="parameterId"])'
    );
    await categoryParameterAttachForm
      .locator('select[name="parameterId"]')
      .selectOption({
        label: mountingName
      });
    await expect(
      categoryParameterAttachForm.locator('select[name="defaultValue"]')
    ).toBeVisible();
    await categoryParameterAttachForm
      .locator('select[name="defaultValue"]')
      .selectOption({
        label: "SMD"
      });
    await categoryParameterAttachForm
      .getByRole("button", { name: "Attach" })
      .click();
    await expect(
      editCategoryDialog
        .getByTestId("category-parameter-draft-row")
        .filter({ hasText: mountingName })
    ).toBeVisible();
    await categoryParameterAttachForm
      .locator('select[name="parameterId"]')
      .selectOption({
        label: polarizedName
      });
    await expect(
      categoryParameterAttachForm.locator('select[name="defaultValue"]')
    ).toBeVisible();
    await categoryParameterAttachForm
      .locator('select[name="defaultValue"]')
      .selectOption({
        label: "Yes"
      });
    await categoryParameterAttachForm
      .getByRole("button", { name: "Attach" })
      .click();
    await expect(
      editCategoryDialog
        .getByTestId("category-parameter-draft-row")
        .filter({ hasText: polarizedName })
    ).toBeVisible();
    await categoryParameterAttachForm
      .locator('select[name="parameterId"]')
      .selectOption({
        label: resistanceName
      });
    await categoryParameterAttachForm.getByLabel("Sort order").fill("10");
    await categoryParameterAttachForm.getByLabel("Default value").fill("10 k");
    await categoryParameterAttachForm
      .getByRole("button", { name: "Attach" })
      .click();
    await expect(
      editCategoryDialog
        .getByTestId("category-parameter-draft-row")
        .filter({ hasText: resistanceName })
    ).toBeVisible();
    await editCategoryDialog.getByLabel("Primary parameter").selectOption({
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
    await expect(
      addPartDialog.getByRole("button", {
        name: /Primary category.*Passives \/ Resistors configured/
      })
    ).toBeVisible();
    await expect(addPartDialog.getByLabel(resistanceName)).toHaveValue("10 kΩ");
    await addPartDialog.getByLabel(resistanceName).fill("4,7 kΩ");
    await addPartDialog.getByRole("button", { name: "Create part" }).click();
    await expect(page.getByRole("status")).toHaveText(
      `Part created: Yageo RC0603-${suffix}.`
    );
    const resistorRow = page.getByRole("row", {
      name: new RegExp(`RC0603-${suffix}.*4.7 kΩ.*Yageo`)
    });
    await expect(resistorRow).toBeVisible();
    await expect(resistorRow).toContainText("Passives / Resistors configured");

    await resistorRow.getByRole("button", { name: "Edit" }).click();
    const editPartDialog = page.getByRole("dialog", { name: "Edit part" });
    await expect(editPartDialog).toBeVisible();
    await editPartDialog.getByLabel("Primary category").click();
    await page.getByPlaceholder("Search categories").fill("diodes");
    await expect(
      editPartDialog.getByRole("button", {
        name: /Primary category.*Semiconductors \/ Diodes/
      })
    ).toBeVisible();
    await expect(page.getByText("Values to remove")).toBeVisible();
    await editPartDialog
      .getByLabel(
        "Confirm removing parameter values that no longer apply to the selected primary category."
      )
      .check();
    await editPartDialog.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status")).toHaveText(
      `Part updated: Yageo RC0603-${suffix}.`
    );
    const updatedResistorRow = page.getByRole("row", {
      name: new RegExp(`RC0603-${suffix}.*Yageo`)
    });
    await expect(updatedResistorRow).toContainText("Semiconductors / Diodes");
    await expect(updatedResistorRow).not.toContainText("4.7 kΩ");
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
