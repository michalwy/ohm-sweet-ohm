import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { prisma } from "../../src/server/db/prisma";
import { createInventoryEntry } from "../../src/server/inventory/entryMutations";
import { createPartCategory } from "../../src/server/parts/categories";
import { createShoppingList } from "../../src/server/shopping-lists/shoppingListMutations";
import { ensureDefaultUnitsForWorkspace, getDefaultPartUnitId } from "../../src/server/units/defaultUnits";
import { POST as mcpPost } from "../../src/app/api/mcp/route";
import { GET as listDesigns, POST as createDesign } from "../../src/app/api/v1/designs/route";
import {
  DELETE as deleteDesign,
  GET as getDesign,
  PATCH as updateDesign
} from "../../src/app/api/v1/designs/[designId]/route";
import { POST as addRevision } from "../../src/app/api/v1/designs/[designId]/revisions/route";
import { PATCH as updateRevision } from "../../src/app/api/v1/design-revisions/[revisionId]/route";
import {
  GET as listLines,
  POST as createLine
} from "../../src/app/api/v1/design-revisions/[revisionId]/bom-lines/route";
import { GET as analyzeShortage } from "../../src/app/api/v1/design-revisions/[revisionId]/shortage/route";
import { POST as addShortageToList } from "../../src/app/api/v1/design-revisions/[revisionId]/shortage/shopping-list/route";
import { DELETE as deleteLine, PUT as replaceLine } from "../../src/app/api/v1/bom-lines/[lineItemId]/route";
import { POST as previewMatches } from "../../src/app/api/v1/bom-lines/preview-matches/route";
import { bearer, createApiTestWorkspace, createTestToken, uniqueSuffix } from "./apiFixtures";

/** Designs, BOM line items and shortage analysis in the REST API and MCP (#283). */

const base = "http://localhost/api/v1";

type Revision = { id: string; revisionNumber: number; notes: string | null };

type Design = {
  id: string;
  name: string;
  description: string | null;
  outputPart: { id: string; catalogNumber: string; currentStock: string };
  revisionCount: number;
  revisions: Revision[];
};

type Line = {
  id: string;
  designators: string;
  quantity: number;
  notes: string | null;
  category: { id: string } | null;
  pinnedPart: { id: string } | null;
  matchCount: number;
};

type Shortage = {
  lines: { lineItemId: string; requiredQty: number; availableQty: number; gapQty: number }[];
  procurement: { partId: string; shortageQty: number; candidates: { partId: string }[] }[];
  cycles: unknown[];
  requiresIncoming: boolean;
};

type ErrorBody = { error: { code: string } };

function params(values: Record<string, string>) {
  return { params: Promise.resolve(values) };
}

function jsonRequest(url: string, method: string, token: string, body?: unknown) {
  return new Request(url, {
    method,
    headers: { ...bearer(token), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

function getRequest(url: string, token: string) {
  return new Request(url, { headers: bearer(token) });
}

async function errorCode(response: Response) {
  return ((await response.json()) as ErrorBody).error.code;
}

async function ok<T>(response: Response): Promise<T> {
  assert.equal(response.status, 200, await response.clone().text());

  return (await response.json()) as T;
}

/**
 * A workspace with a category holding two resistors — the first with 1 in stock, the second with
 * none — a shopping list, and tokens: read-write, read-only, and custom ones with only
 * `designs:read` or only `shopping-lists:write`.
 */
async function setup(label: string) {
  const { workspace, owner } = await createApiTestWorkspace(label);
  const suffix = uniqueSuffix();
  const readWrite = await createTestToken(owner.id, workspace.id, { access: "read-write" });
  const readOnly = await createTestToken(owner.id, workspace.id, { access: "read-only" });
  const designsOnly = await createTestToken(owner.id, workspace.id, {
    access: "custom",
    permissions: ["designs:read"]
  });
  const listsOnly = await createTestToken(owner.id, workspace.id, {
    access: "custom",
    permissions: ["shopping-lists:write"]
  });

  await ensureDefaultUnitsForWorkspace(prisma, workspace.id);
  const unitId = (await getDefaultPartUnitId(prisma, workspace.id)) as string;
  const maker = await prisma.organization.create({
    data: {
      workspaceId: workspace.id,
      name: `Maker ${suffix}`,
      normalizedName: `maker ${suffix}`,
      roles: { create: [{ role: "manufacturer" }] }
    }
  });
  const category = await createPartCategory({
    workspaceId: workspace.id,
    parentId: null,
    name: `Resistors ${suffix}`,
    isAssignable: true
  });
  const first = await prisma.part.create({
    data: { workspaceId: workspace.id, unitId, manufacturerId: maker.id, catalogNumber: `RES-A-${suffix}`, primaryCategoryId: category.id }
  });
  const second = await prisma.part.create({
    data: { workspaceId: workspace.id, unitId, manufacturerId: maker.id, catalogNumber: `RES-B-${suffix}`, primaryCategoryId: category.id }
  });
  const location = await prisma.storageLocation.create({
    data: { workspaceId: workspace.id, name: `Bin ${suffix}`, normalizedName: `bin-${suffix}`, isAssignable: true }
  });

  await createInventoryEntry({
    workspaceId: workspace.id,
    partId: first.id,
    entryType: "RECEIPT",
    quantity: "1",
    toLocationId: location.id
  });

  const list = await createShoppingList({ workspaceId: workspace.id, name: `Restock ${suffix}` });

  return {
    workspace,
    readWrite: readWrite.value,
    readOnly: readOnly.value,
    designsOnly: designsOnly.value,
    listsOnly: listsOnly.value,
    categoryId: category.id,
    firstId: first.id,
    secondId: second.id,
    listId: list.id
  };
}

type Setup = Awaited<ReturnType<typeof setup>>;

/** A design created through REST, with one BOM line R1-R4 in the resistor category. */
async function createDesignWithLine(s: Setup) {
  const design = await ok<Design>(
    await createDesign(jsonRequest(`${base}/designs`, "POST", s.readWrite, { name: "Amplifier" }))
  );
  const revisionId = design.revisions[0].id;
  const line = await ok<Line>(
    await createLine(
      jsonRequest(`${base}/design-revisions/${revisionId}/bom-lines`, "POST", s.readWrite, {
        designators: "R1-R4",
        categoryId: s.categoryId
      }),
      params({ revisionId })
    )
  );

  return { design, revisionId, line };
}

async function connect(token: string) {
  const transport = new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), {
    requestInit: { headers: bearer(token) },
    fetch: async (input, init) => mcpPost(new Request(input, init))
  });
  const client = new Client({ name: "oso-integration-test", version: "1.0.0" });

  await client.connect(transport);

  return client;
}

describe("REST /api/v1 designs and BOMs", () => {
  test("create, read, update a design and its revisions", async () => {
    const s = await setup("dsg-rest");

    const created = await ok<Design>(
      await createDesign(
        jsonRequest(`${base}/designs`, "POST", s.readWrite, { name: "  Amplifier  ", description: "Class A" })
      )
    );

    assert.equal(created.name, "Amplifier");
    assert.equal(created.outputPart.catalogNumber, "DESIGN-0001");
    assert.equal(created.outputPart.currentStock, "0");
    assert.deepEqual(
      created.revisions.map((revision) => revision.revisionNumber),
      [1]
    );

    const taken = await createDesign(
      jsonRequest(`${base}/designs`, "POST", s.readWrite, { name: "Copy", catalogNumber: "DESIGN-0001" })
    );

    assert.equal(taken.status, 409);
    assert.equal(await errorCode(taken), "catalog-number-taken");

    const listed = await ok<{ items: Design[]; totalCount: number }>(
      await listDesigns(getRequest(`${base}/designs?searchQuery=ampli`, s.readWrite))
    );

    assert.deepEqual(
      listed.items.map((design) => design.id),
      [created.id]
    );

    const renamed = await ok<Design>(
      await updateDesign(
        jsonRequest(`${base}/designs/${created.id}`, "PATCH", s.readWrite, { name: "Preamp" }),
        params({ designId: created.id })
      )
    );

    assert.equal(renamed.name, "Preamp");
    assert.equal(renamed.description, "Class A", "an omitted field keeps its value");

    const cleared = await ok<Design>(
      await updateDesign(
        jsonRequest(`${base}/designs/${created.id}`, "PATCH", s.readWrite, { description: null }),
        params({ designId: created.id })
      )
    );

    assert.equal(cleared.description, null);

    const revision = await ok<Revision>(
      await addRevision(
        jsonRequest(`${base}/designs/${created.id}/revisions`, "POST", s.readWrite, { notes: "Bigger caps" }),
        params({ designId: created.id })
      )
    );

    assert.equal(revision.revisionNumber, 2);
    assert.equal(revision.notes, "Bigger caps");

    const noted = await ok<Revision>(
      await updateRevision(
        jsonRequest(`${base}/design-revisions/${revision.id}`, "PATCH", s.readWrite, { notes: null }),
        params({ revisionId: revision.id })
      )
    );

    assert.equal(noted.notes, null);

    const fetched = await ok<Design>(
      await getDesign(getRequest(`${base}/designs/${created.id}`, s.readWrite), params({ designId: created.id }))
    );

    assert.equal(fetched.revisionCount, 2);

    const deleted = await ok<{ designId: string }>(
      await deleteDesign(
        jsonRequest(`${base}/designs/${created.id}`, "DELETE", s.readWrite),
        params({ designId: created.id })
      )
    );

    assert.equal(deleted.designId, created.id);
    assert.equal(await prisma.design.count({ where: { id: created.id } }), 0);
    assert.equal(await prisma.part.count({ where: { id: created.outputPart.id } }), 0);
  });

  test("BOM line items: create, list, preview, replace, delete", async () => {
    const s = await setup("dsg-bom");
    const { revisionId, line } = await createDesignWithLine(s);

    assert.equal(line.quantity, 4);
    assert.equal(line.category?.id, s.categoryId);
    assert.equal(line.matchCount, 2);

    const listed = await ok<{ items: Line[] }>(
      await listLines(getRequest(`${base}/design-revisions/${revisionId}/bom-lines`, s.readWrite), params({ revisionId }))
    );

    assert.deepEqual(
      listed.items.map((item) => item.id),
      [line.id]
    );

    const preview = await ok<{ count: number; parts: { id: string }[] }>(
      await previewMatches(
        jsonRequest(`${base}/bom-lines/preview-matches`, "POST", s.readWrite, { pinnedPartId: s.secondId })
      )
    );

    assert.equal(preview.count, 1);
    assert.deepEqual(
      preview.parts.map((part) => part.id),
      [s.secondId]
    );

    const invalid = await createLine(
      jsonRequest(`${base}/design-revisions/${revisionId}/bom-lines`, "POST", s.readWrite, { designators: "R1, R1" }),
      params({ revisionId })
    );

    assert.equal(invalid.status, 409);
    assert.equal(await errorCode(invalid), "duplicate-designator");

    const replaced = await ok<Line>(
      await replaceLine(
        jsonRequest(`${base}/bom-lines/${line.id}`, "PUT", s.readWrite, {
          designators: "R1, R2",
          pinnedPartId: s.firstId,
          notes: "1%"
        }),
        params({ lineItemId: line.id })
      )
    );

    assert.equal(replaced.quantity, 2);
    assert.equal(replaced.category, null, "a field not sent is cleared");
    assert.equal(replaced.pinnedPart?.id, s.firstId);
    assert.equal(replaced.notes, "1%");

    await ok(
      await deleteLine(jsonRequest(`${base}/bom-lines/${line.id}`, "DELETE", s.readWrite), params({ lineItemId: line.id }))
    );

    assert.equal(await prisma.bomLineItem.count({ where: { id: line.id } }), 0);
  });

  test("shortage analysis, and adding it to a shopping list as the UI does", async () => {
    const s = await setup("dsg-short");
    const { revisionId, line } = await createDesignWithLine(s);

    const shortage = await ok<Shortage>(
      await analyzeShortage(
        getRequest(`${base}/design-revisions/${revisionId}/shortage?targetQuantity=2`, s.designsOnly),
        params({ revisionId })
      )
    );

    assert.deepEqual(shortage.lines, [
      { ...shortage.lines[0], lineItemId: line.id, requiredQty: 8, availableQty: 1, gapQty: 7 }
    ]);
    assert.equal(shortage.procurement.length, 1);
    assert.equal(shortage.procurement[0].partId, s.firstId);
    assert.equal(shortage.procurement[0].shortageQty, 7);
    assert.deepEqual(
      shortage.procurement[0].candidates.map((candidate) => candidate.partId),
      [s.firstId, s.secondId]
    );

    const badSubstitute = await addShortageToList(
      jsonRequest(`${base}/design-revisions/${revisionId}/shortage/shopping-list`, "POST", s.readWrite, {
        targetQuantity: 2,
        listId: s.listId,
        overrides: [{ partId: s.firstId, substitutePartId: line.id }]
      }),
      params({ revisionId })
    );

    assert.equal(badSubstitute.status, 400);
    assert.equal(await errorCode(badSubstitute), "invalid-substitute-part");

    const added = await ok<{ added: { partId: string; quantity: string }[]; list: { items: { partId: string; quantity: string }[] } }>(
      await addShortageToList(
        jsonRequest(`${base}/design-revisions/${revisionId}/shortage/shopping-list`, "POST", s.readWrite, {
          targetQuantity: 2,
          listId: s.listId,
          overrides: [{ partId: s.firstId, substitutePartId: s.secondId, quantity: 10 }]
        }),
        params({ revisionId })
      )
    );

    assert.deepEqual(added.added, [{ partId: s.secondId, quantity: "10" }]);
    assert.deepEqual(
      added.list.items.map((item) => [item.partId, item.quantity]),
      [[s.secondId, "10"]]
    );

    const again = await ok<{ list: { items: { partId: string; quantity: string }[] } }>(
      await addShortageToList(
        jsonRequest(`${base}/design-revisions/${revisionId}/shortage/shopping-list`, "POST", s.readWrite, {
          targetQuantity: 1,
          listId: s.listId
        }),
        params({ revisionId })
      )
    );

    assert.deepEqual(
      again.list.items.map((item) => [item.partId, item.quantity]).sort(),
      [
        [s.firstId, "3"],
        [s.secondId, "10"]
      ].sort()
    );

    const nothing = await addShortageToList(
      jsonRequest(`${base}/design-revisions/${revisionId}/shortage/shopping-list`, "POST", s.readWrite, {
        targetQuantity: 1,
        listId: s.listId,
        overrides: [{ partId: s.firstId, quantity: 0 }]
      }),
      params({ revisionId })
    );

    assert.equal(nothing.status, 409);
    assert.equal(await errorCode(nothing), "nothing-to-add");
  });

  test("a token without the permission is refused", async () => {
    const s = await setup("dsg-deny");
    const { design, revisionId, line } = await createDesignWithLine(s);

    const denied: Response[] = [
      await createDesign(jsonRequest(`${base}/designs`, "POST", s.readOnly, { name: "Nope" })),
      await updateDesign(
        jsonRequest(`${base}/designs/${design.id}`, "PATCH", s.readOnly, { name: "Nope" }),
        params({ designId: design.id })
      ),
      await deleteDesign(jsonRequest(`${base}/designs/${design.id}`, "DELETE", s.readOnly), params({ designId: design.id })),
      await addRevision(
        jsonRequest(`${base}/designs/${design.id}/revisions`, "POST", s.readOnly, {}),
        params({ designId: design.id })
      ),
      await updateRevision(
        jsonRequest(`${base}/design-revisions/${revisionId}`, "PATCH", s.readOnly, { notes: "x" }),
        params({ revisionId })
      ),
      await createLine(
        jsonRequest(`${base}/design-revisions/${revisionId}/bom-lines`, "POST", s.readOnly, { designators: "C1" }),
        params({ revisionId })
      ),
      await replaceLine(
        jsonRequest(`${base}/bom-lines/${line.id}`, "PUT", s.readOnly, { designators: "C1" }),
        params({ lineItemId: line.id })
      ),
      await deleteLine(jsonRequest(`${base}/bom-lines/${line.id}`, "DELETE", s.readOnly), params({ lineItemId: line.id })),
      await addShortageToList(
        jsonRequest(`${base}/design-revisions/${revisionId}/shortage/shopping-list`, "POST", s.readOnly, {
          targetQuantity: 1,
          listId: s.listId
        }),
        params({ revisionId })
      ),
      // shopping-lists:write alone does not let the shortage be read
      await addShortageToList(
        jsonRequest(`${base}/design-revisions/${revisionId}/shortage/shopping-list`, "POST", s.listsOnly, {
          targetQuantity: 1,
          listId: s.listId
        }),
        params({ revisionId })
      ),
      await listDesigns(getRequest(`${base}/designs`, s.listsOnly)),
      await analyzeShortage(
        getRequest(`${base}/design-revisions/${revisionId}/shortage?targetQuantity=1`, s.listsOnly),
        params({ revisionId })
      ),
      await previewMatches(jsonRequest(`${base}/bom-lines/preview-matches`, "POST", s.listsOnly, {}))
    ];

    for (const response of denied) {
      assert.equal(response.status, 403);
      assert.equal(await errorCode(response), "permission-denied");
    }

    assert.equal((await prisma.design.findUniqueOrThrow({ where: { id: design.id } })).name, "Amplifier");
    assert.equal(await prisma.bomLineItem.count({ where: { id: line.id } }), 1);
    assert.equal(await prisma.shoppingListItem.count({ where: { shoppingListId: s.listId } }), 0);
  });

  test("a token for workspace A neither sees nor changes workspace B's designs", async () => {
    const a = await setup("dsg-iso-a");
    const b = await setup("dsg-iso-b");
    const foreign = await createDesignWithLine(b);
    const designId = foreign.design.id;
    const revisionId = foreign.revisionId;
    const lineItemId = foreign.line.id;

    const listed = await ok<{ items: unknown[] }>(await listDesigns(getRequest(`${base}/designs`, a.readWrite)));

    assert.deepEqual(listed.items, []);

    const expectations: [Response, string][] = [
      [await getDesign(getRequest(`${base}/designs/${designId}`, a.readWrite), params({ designId })), "design-not-found"],
      [
        await updateDesign(jsonRequest(`${base}/designs/${designId}`, "PATCH", a.readWrite, { name: "x" }), params({ designId })),
        "design-not-found"
      ],
      [await deleteDesign(jsonRequest(`${base}/designs/${designId}`, "DELETE", a.readWrite), params({ designId })), "design-not-found"],
      [
        await addRevision(jsonRequest(`${base}/designs/${designId}/revisions`, "POST", a.readWrite, {}), params({ designId })),
        "design-not-found"
      ],
      [
        await updateRevision(
          jsonRequest(`${base}/design-revisions/${revisionId}`, "PATCH", a.readWrite, { notes: "x" }),
          params({ revisionId })
        ),
        "revision-not-found"
      ],
      [
        await listLines(getRequest(`${base}/design-revisions/${revisionId}/bom-lines`, a.readWrite), params({ revisionId })),
        "revision-not-found"
      ],
      [
        await createLine(
          jsonRequest(`${base}/design-revisions/${revisionId}/bom-lines`, "POST", a.readWrite, { designators: "C1" }),
          params({ revisionId })
        ),
        "revision-not-found"
      ],
      [
        await replaceLine(
          jsonRequest(`${base}/bom-lines/${lineItemId}`, "PUT", a.readWrite, { designators: "C1" }),
          params({ lineItemId })
        ),
        "line-item-not-found"
      ],
      [
        await deleteLine(jsonRequest(`${base}/bom-lines/${lineItemId}`, "DELETE", a.readWrite), params({ lineItemId })),
        "line-item-not-found"
      ],
      [
        await analyzeShortage(
          getRequest(`${base}/design-revisions/${revisionId}/shortage?targetQuantity=1`, a.readWrite),
          params({ revisionId })
        ),
        "revision-not-found"
      ],
      [
        await addShortageToList(
          jsonRequest(`${base}/design-revisions/${revisionId}/shortage/shopping-list`, "POST", a.readWrite, {
            targetQuantity: 1,
            listId: a.listId
          }),
          params({ revisionId })
        ),
        "revision-not-found"
      ],
      [
        await addShortageToList(
          jsonRequest(`${base}/design-revisions/${a.listId}/shortage/shopping-list`, "POST", a.readWrite, {
            targetQuantity: 1,
            listId: b.listId
          }),
          params({ revisionId: a.listId })
        ),
        "shopping-list-not-found"
      ],
      [
        await createLine(
          jsonRequest(`${base}/design-revisions/${revisionId}/bom-lines`, "POST", b.readWrite, {
            designators: "C1",
            pinnedPartId: a.firstId
          }),
          params({ revisionId })
        ),
        "part-not-found"
      ]
    ];

    for (const [response, code] of expectations) {
      assert.equal(response.status, 404);
      assert.equal(await errorCode(response), code);
    }

    const preview = await ok<{ count: number }>(
      await previewMatches(jsonRequest(`${base}/bom-lines/preview-matches`, "POST", a.readWrite, { pinnedPartId: b.firstId }))
    );

    assert.equal(preview.count, 0);
    assert.equal((await prisma.design.findUniqueOrThrow({ where: { id: designId } })).name, "Amplifier");
    assert.equal(await prisma.bomLineItem.count({ where: { revisionId } }), 1);
  });
});

describe("MCP design tools", () => {
  test("annotations, and design → BOM → shortage → shopping list through the tools", async () => {
    const s = await setup("dsg-mcp");
    const client = await connect(s.readWrite);
    const { tools } = await client.listTools();
    const annotations = Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations]));

    for (const name of ["list_designs", "get_design", "list_bom_line_items", "preview_bom_line_item_matches", "analyze_shortage"]) {
      assert.equal(annotations[name]?.readOnlyHint, true, name);
    }

    for (const name of ["delete_design", "delete_bom_line_item", "update_design", "update_design_revision", "update_bom_line_item"]) {
      assert.equal(annotations[name]?.destructiveHint, true, name);
    }

    for (const name of ["create_design", "add_design_revision", "create_bom_line_item", "add_shortage_to_shopping_list"]) {
      assert.equal(annotations[name]?.readOnlyHint, false, name);
      assert.equal(annotations[name]?.destructiveHint, false, name);
    }

    const created = await client.callTool({ name: "create_design", arguments: { name: "Tuner", catalogNumber: "TUNER-1" } });

    assert.ok(!created.isError, JSON.stringify(created));

    const design = created.structuredContent as Design;
    const revisionId = design.revisions[0].id;
    const line = await client.callTool({
      name: "create_bom_line_item",
      arguments: { revisionId, designators: "R1", pinnedPartId: s.secondId }
    });

    assert.ok(!line.isError, JSON.stringify(line));

    const shortage = await client.callTool({ name: "analyze_shortage", arguments: { revisionId, targetQuantity: 3 } });

    assert.ok(!shortage.isError, JSON.stringify(shortage));
    assert.equal((shortage.structuredContent as Shortage).procurement[0].shortageQty, 3);

    const added = await client.callTool({
      name: "add_shortage_to_shopping_list",
      arguments: { revisionId, targetQuantity: 3, listId: s.listId }
    });

    assert.ok(!added.isError, JSON.stringify(added));
    assert.deepEqual((added.structuredContent as { added: unknown[] }).added, [{ partId: s.secondId, quantity: "3" }]);

    await client.close();
  });

  test("a read-only token cannot call a writing tool, nor reach another workspace", async () => {
    const a = await setup("dsg-mcp-a");
    const b = await setup("dsg-mcp-b");
    const foreign = await createDesignWithLine(b);
    const client = await connect(a.readOnly);

    const denied = await client.callTool({ name: "create_design", arguments: { name: "Nope" } });

    assert.equal(denied.isError, true);
    assert.match(JSON.stringify(denied.content), /permission-denied/);

    const isolated = await client.callTool({ name: "get_design", arguments: { designId: foreign.design.id } });

    assert.equal(isolated.isError, true);
    assert.match(JSON.stringify(isolated.content), /design-not-found/);

    const shortage = await client.callTool({
      name: "analyze_shortage",
      arguments: { revisionId: foreign.revisionId, targetQuantity: 1 }
    });

    assert.equal(shortage.isError, true);
    assert.match(JSON.stringify(shortage.content), /revision-not-found/);

    await client.close();
  });
});
