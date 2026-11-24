import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { POST as mcpPost } from "../../src/app/api/mcp/route";
import * as attributeRoutes from "../../src/app/api/v1/attributes/route";
import * as attributeRoute from "../../src/app/api/v1/attributes/[attributeId]/route";
import * as choiceOptionsRoute from "../../src/app/api/v1/attributes/[attributeId]/choice-options/route";
import * as choiceOptionRoute from "../../src/app/api/v1/attribute-choice-options/[optionId]/route";
import * as categoriesRoute from "../../src/app/api/v1/part-categories/route";
import * as categoryPathsRoute from "../../src/app/api/v1/part-categories/paths/route";
import * as categoryRoute from "../../src/app/api/v1/part-categories/[categoryId]/route";
import * as categoryMoveRoute from "../../src/app/api/v1/part-categories/[categoryId]/move/route";
import * as categoryAttributesRoute from "../../src/app/api/v1/part-categories/[categoryId]/attributes/route";
import * as categoryAttributeRoute from "../../src/app/api/v1/part-categories/[categoryId]/attributes/[attributeId]/route";
import * as valueAttributeRoute from "../../src/app/api/v1/part-categories/[categoryId]/value-attribute/route";
import * as unitsRoute from "../../src/app/api/v1/units/route";
import * as unitRoute from "../../src/app/api/v1/units/[unitId]/route";
import * as workspaceAttributesRoute from "../../src/app/api/v1/workspace/attributes/route";
import { prisma } from "../../src/server/db/prisma";
import { bearer, createApiTestWorkspace, createTestToken, uniqueSuffix } from "./apiFixtures";

/**
 * Categories, attributes and units through REST and MCP (#278): per group the happy path, a token
 * without the permission, and workspace isolation (a token for A neither sees nor changes B).
 */

type Handler = (
  request: Request,
  context?: { params: Promise<Record<string, string>> }
) => Promise<Response>;

const base = "http://localhost/api/v1";

async function call(
  handler: Handler,
  token: string,
  {
    method = "GET",
    path = "",
    params,
    body,
    query
  }: {
    method?: string;
    path?: string;
    params?: Record<string, string>;
    body?: unknown;
    query?: Record<string, string>;
  } = {}
) {
  const url = new URL(`${base}${path}`);

  for (const [key, value] of Object.entries(query ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await handler(
    new Request(url, {
      method,
      headers: { ...bearer(token), "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
    params ? { params: Promise.resolve(params) } : undefined
  );

  return { status: response.status, body: await response.json() };
}

async function setup(label: string) {
  const a = await createApiTestWorkspace(`${label}-a`);
  const b = await createApiTestWorkspace(`${label}-b`);
  const writeA = await createTestToken(a.owner.id, a.workspace.id, { access: "read-write" });
  const readA = await createTestToken(a.owner.id, a.workspace.id, { access: "read-only" });
  const writeB = await createTestToken(b.owner.id, b.workspace.id, { access: "read-write" });

  return { a, b, writeA: writeA.value, readA: readA.value, writeB: writeB.value };
}

async function connectMcp(token: string) {
  const transport = new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), {
    requestInit: { headers: bearer(token) },
    fetch: async (input, init) => mcpPost(new Request(input, init))
  });
  const client = new Client({ name: "oso-dictionaries-test", version: "1.0.0" });

  await client.connect(transport);

  return client;
}

describe("units API (#278)", () => {
  test("list, create, update and delete a unit", async () => {
    const { writeA } = await setup("units");
    const name = `Metre ${uniqueSuffix()}`;

    const created = await call(unitsRoute.POST, writeA, {
      method: "POST",
      body: { name, symbol: "m", allowsFraction: true }
    });

    assert.equal(created.status, 200, JSON.stringify(created.body));
    assert.equal(created.body.name, name);

    const duplicate = await call(unitsRoute.POST, writeA, {
      method: "POST",
      body: { name: name.toUpperCase(), symbol: "M", allowsFraction: true }
    });

    assert.equal(duplicate.status, 409);
    assert.equal(duplicate.body.error.code, "duplicate-unit-name");

    const updated = await call(unitRoute.PATCH, writeA, {
      method: "PATCH",
      path: `/units/${created.body.id}`,
      params: { unitId: created.body.id },
      body: { symbol: "mm" }
    });

    assert.equal(updated.status, 200, JSON.stringify(updated.body));
    assert.deepEqual(updated.body, { ...created.body, symbol: "mm" });

    const listed = await call(unitsRoute.GET, writeA, { query: { pageSize: "100" } });

    assert.equal(listed.status, 200);
    assert.ok(listed.body.items.some((unit: { id: string }) => unit.id === created.body.id));

    const deleted = await call(unitRoute.DELETE, writeA, {
      method: "DELETE",
      path: `/units/${created.body.id}`,
      params: { unitId: created.body.id }
    });

    assert.deepEqual(deleted.body, { id: created.body.id });
    assert.equal(await prisma.unit.count({ where: { id: created.body.id } }), 0);
  });

  test("a read-only token cannot write, and another workspace's unit is not found", async () => {
    const { a, b, readA, writeB } = await setup("units-guard");
    const unit = await prisma.unit.create({
      data: { workspaceId: a.workspace.id, name: "Probe", normalizedName: "probe", symbol: "p", allowsFraction: false }
    });

    const denied = await call(unitsRoute.POST, readA, {
      method: "POST",
      body: { name: "Nope", symbol: "n", allowsFraction: false }
    });

    assert.equal(denied.status, 403);
    assert.equal(denied.body.error.code, "permission-denied");

    const foreign = await call(unitRoute.DELETE, writeB, {
      method: "DELETE",
      path: `/units/${unit.id}`,
      params: { unitId: unit.id }
    });

    assert.equal(foreign.status, 404);
    assert.equal(foreign.body.error.code, "unit-not-found");

    const listB = await call(unitsRoute.GET, writeB, { query: { pageSize: "100" } });

    assert.ok(listB.body.items.every((item: { id: string }) => item.id !== unit.id));
    assert.equal(await prisma.unit.count({ where: { id: unit.id, workspaceId: a.workspace.id } }), 1);
    void b;
  });
});

describe("part categories API (#278)", () => {
  test("create, create a path, read the tree, update, move and delete", async () => {
    const { writeA } = await setup("categories");

    const passives = await call(categoriesRoute.POST, writeA, {
      method: "POST",
      body: { name: "Passives", isAssignable: false }
    });

    assert.equal(passives.status, 200, JSON.stringify(passives.body));
    assert.equal(passives.body.path, "Passives");

    const smd = await call(categoryPathsRoute.POST, writeA, {
      method: "POST",
      body: { path: "Passives/Resistors/SMD" }
    });

    assert.equal(smd.status, 200, JSON.stringify(smd.body));
    assert.equal(smd.body.path, "Passives » Resistors » SMD");
    assert.equal(smd.body.isAssignable, true);

    const tree = await call(categoriesRoute.GET, writeA);
    const paths = tree.body.categories.map((category: { path: string }) => category.path);

    assert.deepEqual(paths, ["Passives", "Passives » Resistors", "Passives » Resistors » SMD"]);

    const renamed = await call(categoryRoute.PATCH, writeA, {
      method: "PATCH",
      path: `/part-categories/${smd.body.id}`,
      params: { categoryId: smd.body.id },
      body: { name: "Surface mount" }
    });

    assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
    assert.equal(renamed.body.path, "Passives » Resistors » Surface mount");
    assert.equal(renamed.body.isAssignable, true);

    const moved = await call(categoryMoveRoute.POST, writeA, {
      method: "POST",
      path: `/part-categories/${smd.body.id}/move`,
      params: { categoryId: smd.body.id },
      body: { parentId: null }
    });

    assert.equal(moved.status, 200, JSON.stringify(moved.body));
    assert.equal(moved.body.path, "Surface mount");
    assert.equal(moved.body.parentId, null);

    const cycle = await call(categoryMoveRoute.POST, writeA, {
      method: "POST",
      path: `/part-categories/${passives.body.id}/move`,
      params: { categoryId: passives.body.id },
      body: { parentId: passives.body.id }
    });

    assert.equal(cycle.status, 400);
    assert.equal(cycle.body.error.code, "invalid-parent-category");

    const hasChildren = await call(categoryRoute.DELETE, writeA, {
      method: "DELETE",
      path: `/part-categories/${passives.body.id}`,
      params: { categoryId: passives.body.id }
    });

    assert.equal(hasChildren.status, 409);
    assert.equal(hasChildren.body.error.code, "category-has-children");

    const deleted = await call(categoryRoute.DELETE, writeA, {
      method: "DELETE",
      path: `/part-categories/${smd.body.id}`,
      params: { categoryId: smd.body.id }
    });

    assert.deepEqual(deleted.body, { id: smd.body.id });
  });

  test("a token without part-categories:write is refused; another workspace's category is not found", async () => {
    const { a, writeA, writeB } = await setup("categories-guard");
    const attributesOnly = await createTestToken(a.owner.id, a.workspace.id, {
      access: "custom",
      permissions: ["part-categories:read"]
    });
    const category = await call(categoriesRoute.POST, writeA, {
      method: "POST",
      body: { name: "Semiconductors", isAssignable: true }
    });

    const denied = await call(categoryRoute.DELETE, attributesOnly.value, {
      method: "DELETE",
      path: `/part-categories/${category.body.id}`,
      params: { categoryId: category.body.id }
    });

    assert.equal(denied.status, 403);

    const foreignUpdate = await call(categoryRoute.PATCH, writeB, {
      method: "PATCH",
      path: `/part-categories/${category.body.id}`,
      params: { categoryId: category.body.id },
      body: { name: "Hijacked" }
    });

    assert.equal(foreignUpdate.status, 404);
    assert.equal(foreignUpdate.body.error.code, "category-not-found");

    const foreignParent = await call(categoriesRoute.POST, writeB, {
      method: "POST",
      body: { name: "Child", parentId: category.body.id, isAssignable: true }
    });

    assert.equal(foreignParent.status, 400);
    assert.equal(foreignParent.body.error.code, "invalid-parent-category");

    const treeB = await call(categoriesRoute.GET, writeB);

    assert.deepEqual(treeB.body.categories, []);

    const stored = await prisma.partCategory.findUniqueOrThrow({ where: { id: category.body.id } });

    assert.equal(stored.name, "Semiconductors");
  });
});

describe("attributes API (#278)", () => {
  test("dictionary: create, update, choice options, list and delete", async () => {
    const { writeA } = await setup("attributes");

    const resistance = await call(attributeRoutes.POST, writeA, {
      method: "POST",
      body: { name: "Resistance", type: "QUANTITY", baseUnitSymbol: "ohm" }
    });

    assert.equal(resistance.status, 200, JSON.stringify(resistance.body));
    assert.equal(resistance.body.baseUnitSymbol, "Ω");

    const missingUnit = await call(attributeRoutes.POST, writeA, {
      method: "POST",
      body: { name: "Capacitance", type: "QUANTITY" }
    });

    assert.equal(missingUnit.status, 400);
    assert.equal(missingUnit.body.error.code, "quantity-unit-required");

    const pkg = await call(attributeRoutes.POST, writeA, {
      method: "POST",
      body: {
        name: "Package",
        type: "CHOICE",
        choiceOptions: [
          { label: "0603", sortOrder: 1 },
          { label: "0805", sortOrder: 2 }
        ]
      }
    });

    assert.equal(pkg.status, 200, JSON.stringify(pkg.body));
    assert.deepEqual(
      pkg.body.choiceOptions.map((option: { label: string }) => option.label),
      ["0603", "0805"]
    );

    const option = await call(choiceOptionsRoute.POST, writeA, {
      method: "POST",
      path: `/attributes/${pkg.body.id}/choice-options`,
      params: { attributeId: pkg.body.id },
      body: { label: "1206", sortOrder: 3 }
    });

    assert.equal(option.status, 200, JSON.stringify(option.body));

    const duplicateOption = await call(choiceOptionsRoute.POST, writeA, {
      method: "POST",
      path: `/attributes/${pkg.body.id}/choice-options`,
      params: { attributeId: pkg.body.id },
      body: { label: "1206", sortOrder: 4 }
    });

    assert.equal(duplicateOption.status, 409);
    assert.equal(duplicateOption.body.error.code, "duplicate-choice-option");

    const notChoice = await call(choiceOptionsRoute.POST, writeA, {
      method: "POST",
      path: `/attributes/${resistance.body.id}/choice-options`,
      params: { attributeId: resistance.body.id },
      body: { label: "x", sortOrder: 1 }
    });

    assert.equal(notChoice.status, 404);
    assert.equal(notChoice.body.error.code, "choice-attribute-not-found");

    const renamedOption = await call(choiceOptionRoute.PATCH, writeA, {
      method: "PATCH",
      path: `/attribute-choice-options/${option.body.id}`,
      params: { optionId: option.body.id },
      body: { label: "1206 (3216)" }
    });

    assert.deepEqual(renamedOption.body, { ...option.body, label: "1206 (3216)" });

    const deletedOption = await call(choiceOptionRoute.DELETE, writeA, {
      method: "DELETE",
      path: `/attribute-choice-options/${option.body.id}`,
      params: { optionId: option.body.id }
    });

    assert.deepEqual(deletedOption.body, { id: option.body.id });

    const described = await call(attributeRoute.PATCH, writeA, {
      method: "PATCH",
      path: `/attributes/${resistance.body.id}`,
      params: { attributeId: resistance.body.id },
      body: { description: "Nominal resistance" }
    });

    assert.equal(described.status, 200, JSON.stringify(described.body));
    assert.equal(described.body.description, "Nominal resistance");
    assert.equal(described.body.type, "QUANTITY");
    assert.equal(described.body.baseUnitSymbol, "Ω");

    const listed = await call(attributeRoutes.GET, writeA, { query: { sortBy: "name", sortDir: "desc" } });

    assert.equal(listed.status, 200);
    assert.deepEqual(
      listed.body.items.map((item: { name: string }) => item.name),
      ["Resistance", "Package"]
    );

    const deleted = await call(attributeRoute.DELETE, writeA, {
      method: "DELETE",
      path: `/attributes/${pkg.body.id}`,
      params: { attributeId: pkg.body.id }
    });

    assert.deepEqual(deleted.body, { id: pkg.body.id });
  });

  test("category and workspace configuration: attach, value attribute, save, detach", async () => {
    const { writeA } = await setup("attribute-config");
    const resistors = await call(categoriesRoute.POST, writeA, {
      method: "POST",
      body: { name: "Resistors", isAssignable: true }
    });
    const smd = await call(categoryPathsRoute.POST, writeA, {
      method: "POST",
      body: { path: "SMD", parentId: resistors.body.id }
    });
    const resistance = await call(attributeRoutes.POST, writeA, {
      method: "POST",
      body: { name: "Resistance", type: "QUANTITY", baseUnitSymbol: "Ω" }
    });
    const tolerance = await call(attributeRoutes.POST, writeA, {
      method: "POST",
      body: { name: "Tolerance", type: "TEXT" }
    });
    const note = await call(attributeRoutes.POST, writeA, {
      method: "POST",
      body: { name: "Note", type: "TEXT" }
    });

    const attached = await call(categoryAttributeRoute.PUT, writeA, {
      method: "PUT",
      path: `/part-categories/${resistors.body.id}/attributes/${resistance.body.id}`,
      params: { categoryId: resistors.body.id, attributeId: resistance.body.id },
      body: { sortOrder: 1, defaultValue: "10k", isPrimary: true }
    });

    assert.equal(attached.status, 200, JSON.stringify(attached.body));
    assert.equal(attached.body.attributes[0].attribute.id, resistance.body.id);
    assert.equal(attached.body.attributes[0].sourceCategoryId, resistors.body.id);
    assert.equal(attached.body.attributes[0].defaultValue.quantityBaseValue, "10000");

    const badDefault = await call(categoryAttributeRoute.PUT, writeA, {
      method: "PUT",
      path: `/part-categories/${resistors.body.id}/attributes/${resistance.body.id}`,
      params: { categoryId: resistors.body.id, attributeId: resistance.body.id },
      body: { sortOrder: 1, defaultValue: "ten volts" }
    });

    assert.equal(badDefault.status >= 400 && badDefault.status < 500, true);

    const valueSet = await call(valueAttributeRoute.PUT, writeA, {
      method: "PUT",
      path: `/part-categories/${resistors.body.id}/value-attribute`,
      params: { categoryId: resistors.body.id },
      body: { attributeId: resistance.body.id }
    });

    assert.equal(valueSet.status, 200, JSON.stringify(valueSet.body));
    assert.equal(valueSet.body.attributes[0].isValue, true);

    const notEffective = await call(valueAttributeRoute.PUT, writeA, {
      method: "PUT",
      path: `/part-categories/${resistors.body.id}/value-attribute`,
      params: { categoryId: resistors.body.id },
      body: { attributeId: tolerance.body.id }
    });

    assert.equal(notEffective.status, 409);
    assert.equal(notEffective.body.error.code, "primary-attribute-not-effective");

    // The subcategory inherits Resistance and overrides it; its effective attribute lists the
    // parent's configuration under overrides.
    const saved = await call(categoryAttributesRoute.PUT, writeA, {
      method: "PUT",
      path: `/part-categories/${smd.body.id}/attributes`,
      params: { categoryId: smd.body.id },
      body: {
        valueAttributeId: null,
        attributes: [
          { attributeId: resistance.body.id, sortOrder: 2, defaultValue: null },
          { attributeId: tolerance.body.id, sortOrder: 1, defaultValue: "1%" }
        ]
      }
    });

    assert.equal(saved.status, 200, JSON.stringify(saved.body));

    const effective = await call(categoryAttributesRoute.GET, writeA, {
      path: `/part-categories/${smd.body.id}/attributes`,
      params: { categoryId: smd.body.id }
    });

    assert.deepEqual(effective.body, saved.body);

    const [first, second] = effective.body.attributes;

    assert.equal(first.attribute.name, "Tolerance");
    assert.equal(second.attribute.name, "Resistance");
    assert.equal(second.sourceCategoryId, smd.body.id);
    assert.equal(second.isValue, true, "the value attribute is inherited from Resistors");
    assert.equal(second.overrides.length, 1);
    assert.equal(second.overrides[0].sourceCategoryId, resistors.body.id);

    const detached = await call(categoryAttributeRoute.DELETE, writeA, {
      method: "DELETE",
      path: `/part-categories/${smd.body.id}/attributes/${tolerance.body.id}`,
      params: { categoryId: smd.body.id, attributeId: tolerance.body.id }
    });

    assert.deepEqual(
      detached.body.attributes.map((item: { attribute: { name: string } }) => item.attribute.name),
      ["Resistance"]
    );

    const workspaceSaved = await call(workspaceAttributesRoute.PUT, writeA, {
      method: "PUT",
      path: "/workspace/attributes",
      body: { attributes: [{ attributeId: note.body.id, sortOrder: 9 }] }
    });

    assert.equal(workspaceSaved.status, 200, JSON.stringify(workspaceSaved.body));
    assert.equal(workspaceSaved.body.attributes[0].sourceCategoryId, null);

    const workspaceRead = await call(workspaceAttributesRoute.GET, writeA, {
      path: "/workspace/attributes"
    });

    assert.deepEqual(workspaceRead.body, workspaceSaved.body);

    const inUse = await call(attributeRoute.DELETE, writeA, {
      method: "DELETE",
      path: `/attributes/${note.body.id}`,
      params: { attributeId: note.body.id }
    });

    assert.equal(inUse.status, 409);
    assert.equal(inUse.body.error.code, "attribute-in-use");
  });

  test("a read-only token cannot change attributes; another workspace's are not found", async () => {
    const { readA, writeA, writeB } = await setup("attributes-guard");
    const category = await call(categoriesRoute.POST, writeA, {
      method: "POST",
      body: { name: "Capacitors", isAssignable: true }
    });
    const attribute = await call(attributeRoutes.POST, writeA, {
      method: "POST",
      body: { name: "Voltage", type: "QUANTITY", baseUnitSymbol: "V" }
    });

    const denied = await call(attributeRoute.PATCH, readA, {
      method: "PATCH",
      path: `/attributes/${attribute.body.id}`,
      params: { attributeId: attribute.body.id },
      body: { name: "Volts" }
    });

    assert.equal(denied.status, 403);

    const readable = await call(categoryAttributesRoute.GET, readA, {
      path: `/part-categories/${category.body.id}/attributes`,
      params: { categoryId: category.body.id }
    });

    assert.equal(readable.status, 200);

    const foreignAttribute = await call(attributeRoute.DELETE, writeB, {
      method: "DELETE",
      path: `/attributes/${attribute.body.id}`,
      params: { attributeId: attribute.body.id }
    });

    assert.equal(foreignAttribute.status, 404);

    const foreignCategory = await call(categoryAttributesRoute.GET, writeB, {
      path: `/part-categories/${category.body.id}/attributes`,
      params: { categoryId: category.body.id }
    });

    assert.equal(foreignCategory.status, 404);
    assert.equal(foreignCategory.body.error.code, "category-not-found");

    const ownCategoryB = await call(categoriesRoute.POST, writeB, {
      method: "POST",
      body: { name: "B's", isAssignable: true }
    });
    const foreignAttach = await call(categoryAttributeRoute.PUT, writeB, {
      method: "PUT",
      path: `/part-categories/${ownCategoryB.body.id}/attributes/${attribute.body.id}`,
      params: { categoryId: ownCategoryB.body.id, attributeId: attribute.body.id },
      body: { sortOrder: 1 }
    });

    assert.equal(foreignAttach.status, 404);
    assert.equal(foreignAttach.body.error.code, "attribute-not-found");

    const listB = await call(attributeRoutes.GET, writeB);

    assert.deepEqual(listB.body.items, []);
    assert.equal(
      (await prisma.attribute.findUniqueOrThrow({ where: { id: attribute.body.id } })).name,
      "Voltage"
    );
  });
});

describe("dictionary MCP tools (#278)", () => {
  test("tools are offered with their annotations, and call the same domain code", async () => {
    const { a, writeA, writeB } = await setup("dictionaries-mcp");
    const unitsOnly = await createTestToken(a.owner.id, a.workspace.id, {
      access: "custom",
      permissions: ["units:read"]
    });
    const client = await connectMcp(writeA);
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    for (const name of ["get_part_category_tree", "list_attributes", "list_units", "get_category_attributes", "get_workspace_attributes"]) {
      assert.equal(byName.get(name)?.annotations?.readOnlyHint, true, name);
    }

    for (const name of ["delete_part_category", "delete_attribute", "delete_attribute_choice_option", "delete_unit", "detach_category_attribute"]) {
      assert.equal(byName.get(name)?.annotations?.destructiveHint, true, name);
    }

    assert.equal(byName.get("create_unit")?.annotations?.destructiveHint, false);

    const created = await client.callTool({
      name: "create_part_category_path",
      arguments: { path: "Semiconductors/Diodes" }
    });

    assert.ok(!created.isError, JSON.stringify(created));

    const category = created.structuredContent as { id: string; path: string };

    assert.equal(category.path, "Semiconductors » Diodes");

    const unit = await client.callTool({
      name: "create_unit",
      arguments: { name: `Reel ${uniqueSuffix()}`, symbol: "reel", allowsFraction: false }
    });

    assert.ok(!unit.isError, JSON.stringify(unit));

    await client.close();

    const limited = await connectMcp(unitsOnly.value);
    const denied = await limited.callTool({ name: "get_part_category_tree", arguments: {} });

    assert.equal(denied.isError, true);
    assert.equal(
      JSON.parse((denied.content as Array<{ text: string }>)[0].text).error.code,
      "permission-denied"
    );

    const units = await limited.callTool({ name: "list_units", arguments: {} });

    assert.ok(!units.isError);

    await limited.close();

    const other = await connectMcp(writeB);
    const foreign = await other.callTool({
      name: "delete_part_category",
      arguments: { categoryId: category.id }
    });

    assert.equal(foreign.isError, true);
    assert.equal(
      JSON.parse((foreign.content as Array<{ text: string }>)[0].text).error.code,
      "category-not-found"
    );

    await other.close();
    assert.equal(await prisma.partCategory.count({ where: { id: category.id } }), 1);
  });
});
