import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { prisma } from "../../src/server/db/prisma";
import { createInventoryEntry } from "../../src/server/inventory/entryMutations";
import { createDesign } from "../../src/server/designs/designs";
import { createBomLineItem } from "../../src/server/designs/bomLineItems";
import { ensureDefaultUnitsForWorkspace, getDefaultPartUnitId } from "../../src/server/units/defaultUnits";
import { POST as mcpPost } from "../../src/app/api/mcp/route";
import { GET as listBuilds, POST as createBuild } from "../../src/app/api/v1/builds/route";
import { GET as getCreateOptions } from "../../src/app/api/v1/builds/create-options/route";
import { DELETE as deleteBuild, GET as getBuild } from "../../src/app/api/v1/builds/[buildId]/route";
import { PUT as setAllocations } from "../../src/app/api/v1/builds/[buildId]/allocations/route";
import { PUT as setLineAllocations } from "../../src/app/api/v1/builds/[buildId]/lines/[lineId]/allocations/route";
import { POST as reassign } from "../../src/app/api/v1/builds/[buildId]/assignments/[assignmentId]/reassign/route";
import { POST as assembleDesignator } from "../../src/app/api/v1/builds/[buildId]/assignments/[assignmentId]/assemble/route";
import { POST as assembleUnit } from "../../src/app/api/v1/builds/[buildId]/assemble-unit/route";
import { POST as startBuild } from "../../src/app/api/v1/builds/[buildId]/start/route";
import { POST as cancelBuild } from "../../src/app/api/v1/builds/[buildId]/cancel/route";
import { GET as getPickList } from "../../src/app/api/v1/builds/[buildId]/pick-list/route";
import { GET as getAssemblyList } from "../../src/app/api/v1/builds/[buildId]/assembly-list/route";
import { GET as getPartBuildAllocations } from "../../src/app/api/v1/parts/[id]/build-allocations/route";
import { GET as getPartProductionBuilds } from "../../src/app/api/v1/parts/[id]/production-builds/route";
import { bearer, createApiTestWorkspace, createTestToken, uniqueSuffix } from "./apiFixtures";

/** Builds in the REST API and MCP (#284). */

const base = "http://localhost/api/v1";

type Line = {
  id: string;
  requiredUnits: number;
  allocations: { part: { id: string }; quantity: number }[];
  assignments: { id: string; designator: string; unitIndex: number; assembled: boolean }[];
  matchCandidates: { id: string }[];
};

type Build = {
  id: string;
  state: string;
  revisionId: string;
  targetQuantity: number;
  outputPart: { id: string };
  lines: Line[];
  units: { unitIndex: number; status: string }[];
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

async function errorCode(response: Response) {
  return ((await response.json()) as ErrorBody).error.code;
}

/**
 * A workspace with a component part (5 in stock at one location), an output location, and a design
 * whose revision has one BOM line pinned to the component with designators R1, R2.
 */
async function setup(label: string) {
  const { workspace, owner } = await createApiTestWorkspace(label);
  const readWrite = await createTestToken(owner.id, workspace.id, { access: "read-write" });
  const readOnly = await createTestToken(owner.id, workspace.id, { access: "read-only" });
  const suffix = uniqueSuffix();

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
  const component = await prisma.part.create({
    data: { workspaceId: workspace.id, unitId, manufacturerId: maker.id, catalogNumber: `RES-${suffix}` }
  });
  const source = await prisma.storageLocation.create({
    data: { workspaceId: workspace.id, name: `Source ${suffix}`, normalizedName: `source-${suffix}`, isAssignable: true }
  });
  const output = await prisma.storageLocation.create({
    data: { workspaceId: workspace.id, name: `Output ${suffix}`, normalizedName: `output-${suffix}`, isAssignable: true }
  });

  await createInventoryEntry({
    workspaceId: workspace.id,
    partId: component.id,
    entryType: "RECEIPT",
    quantity: "5",
    toLocationId: source.id
  });

  const design = await createDesign({
    userId: owner.id,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    name: `Board ${suffix}`,
    catalogNumber: `BOARD-${suffix}`,
    unitId
  });

  assert.ok(design.ok, JSON.stringify(design));

  const revision = await prisma.designRevision.findFirstOrThrow({
    where: { workspaceId: workspace.id, designId: design.id },
    select: { id: true }
  });
  const line = await createBomLineItem({
    userId: owner.id,
    workspaceId: workspace.id,
    revisionId: revision.id,
    input: { designators: "R1, R2", pinnedPartId: component.id, categoryId: null, matchers: [] }
  });

  assert.ok(line.ok, JSON.stringify(line));

  return {
    workspace,
    owner,
    readWrite: readWrite.value,
    readOnly: readOnly.value,
    componentId: component.id,
    sourceId: source.id,
    outputId: output.id,
    revisionId: revision.id
  };
}

type Setup = Awaited<ReturnType<typeof setup>>;

async function createVia(s: Setup, targetQuantity = 1) {
  const response = await createBuild(
    jsonRequest(`${base}/builds`, "POST", s.readWrite, {
      designRevisionId: s.revisionId,
      targetQuantity,
      outputLocationId: s.outputId
    })
  );

  assert.equal(response.status, 200, await response.clone().text());

  return (await response.json()) as Build;
}

async function partStock(partId: string) {
  const part = await prisma.part.findUniqueOrThrow({
    where: { id: partId },
    select: { currentStock: true, reservedQty: true, allocatedQty: true, inProductionQty: true }
  });

  return {
    currentStock: part.currentStock.toString(),
    reservedQty: part.reservedQty.toString(),
    allocatedQty: part.allocatedQty.toString(),
    inProductionQty: part.inProductionQty.toString()
  };
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

describe("REST /api/v1/builds", () => {
  test("create, allocate a line, start, assemble a designator and a unit, with the UI's stock effects", async () => {
    const s = await setup("bld-rest");

    const options = await getCreateOptions(new Request(`${base}/builds/create-options`, { headers: bearer(s.readWrite) }));

    assert.equal(options.status, 200);

    const optionsBody = (await options.json()) as { designs: { revisions: { id: string }[] }[] };

    assert.deepEqual(
      optionsBody.designs.flatMap((design) => design.revisions.map((revision) => revision.id)),
      [s.revisionId]
    );

    const build = await createVia(s, 2);

    assert.equal(build.state, "ALLOCATING");
    assert.equal(build.lines.length, 1);
    assert.equal(build.lines[0].requiredUnits, 4);
    assert.deepEqual(
      build.lines[0].matchCandidates.map((candidate) => candidate.id),
      [s.componentId]
    );

    const line = build.lines[0];
    const allocated = await setLineAllocations(
      jsonRequest(`${base}/builds/${build.id}/lines/${line.id}/allocations`, "PUT", s.readWrite, {
        entries: [{ partId: s.componentId, sourceLocationId: s.sourceId, quantity: 4 }]
      }),
      params({ buildId: build.id, lineId: line.id })
    );

    assert.equal(allocated.status, 200, await allocated.clone().text());
    assert.deepEqual(
      ((await allocated.json()) as Build).lines[0].allocations.map((a) => [a.part.id, a.quantity]),
      [[s.componentId, 4]]
    );
    assert.equal((await partStock(s.componentId)).allocatedQty, "4");

    const listed = await listBuilds(
      new Request(`${base}/builds?stateFilter=ALLOCATING`, { headers: bearer(s.readWrite) })
    );
    const page = (await listed.json()) as { items: { id: string; unitsAllocated: number; unitsTotal: number }[] };

    assert.deepEqual(
      page.items.map((item) => [item.id, item.unitsAllocated, item.unitsTotal]),
      [[build.id, 4, 4]]
    );

    const pickList = await getPickList(
      new Request(`${base}/builds/${build.id}/pick-list`, { headers: bearer(s.readWrite) }),
      params({ buildId: build.id })
    );

    assert.equal(pickList.status, 200);
    assert.deepEqual(
      ((await pickList.json()) as { groups: { locationId: string; entries: { totalQuantity: number }[] }[] }).groups.map(
        (group) => [group.locationId, group.entries.map((entry) => entry.totalQuantity)]
      ),
      [[s.sourceId, [4]]]
    );

    const tooEarly = await getAssemblyList(
      new Request(`${base}/builds/${build.id}/assembly-list`, { headers: bearer(s.readWrite) }),
      params({ buildId: build.id })
    );

    assert.equal(tooEarly.status, 409);
    assert.equal(await errorCode(tooEarly), "build-assembly-list-unavailable");

    const started = await startBuild(
      jsonRequest(`${base}/builds/${build.id}/start`, "POST", s.readWrite),
      params({ buildId: build.id })
    );

    assert.equal(started.status, 200, await started.clone().text());
    assert.deepEqual(await started.json(), { buildId: build.id, state: "STARTED" });
    assert.deepEqual(await partStock(s.componentId), {
      currentStock: "5",
      reservedQty: "4",
      allocatedQty: "0",
      inProductionQty: "0"
    });
    assert.equal((await partStock(build.outputPart.id)).inProductionQty, "2");

    const reservations = await getPartBuildAllocations(
      new Request(`${base}/parts/${s.componentId}/build-allocations`, { headers: bearer(s.readWrite) }),
      params({ id: s.componentId })
    );

    assert.deepEqual(
      ((await reservations.json()) as { items: { buildId: string; reservedQty: number }[] }).items.map((item) => [
        item.buildId,
        item.reservedQty
      ]),
      [[build.id, 4]]
    );

    const production = await getPartProductionBuilds(
      new Request(`${base}/parts/${build.outputPart.id}/production-builds`, { headers: bearer(s.readWrite) }),
      params({ id: build.outputPart.id })
    );

    assert.deepEqual(
      ((await production.json()) as { items: { buildId: string; inProductionQty: number }[] }).items.map((item) => [
        item.buildId,
        item.inProductionQty
      ]),
      [[build.id, 2]]
    );

    const assembly = await getAssemblyList(
      new Request(`${base}/builds/${build.id}/assembly-list`, { headers: bearer(s.readWrite) }),
      params({ buildId: build.id })
    );
    const assemblyBody = (await assembly.json()) as {
      units: { unitIndex: number; entries: { assignmentId: string; designator: string }[] }[];
    };

    assert.deepEqual(
      assemblyBody.units.map((unit) => [unit.unitIndex, unit.entries.map((entry) => entry.designator)]),
      [
        [1, ["R1", "R2"]],
        [2, ["R1", "R2"]]
      ]
    );

    const first = assemblyBody.units[0].entries[0].assignmentId;
    const rerouted = await reassign(
      jsonRequest(`${base}/builds/${build.id}/assignments/${first}/reassign`, "POST", s.readWrite, {
        partId: s.componentId,
        sourceLocationId: s.sourceId
      }),
      params({ buildId: build.id, assignmentId: first })
    );

    assert.equal(rerouted.status, 200, await rerouted.clone().text());

    const one = await assembleDesignator(
      jsonRequest(`${base}/builds/${build.id}/assignments/${first}/assemble`, "POST", s.readWrite),
      params({ buildId: build.id, assignmentId: first })
    );

    assert.equal(one.status, 200, await one.clone().text());
    assert.deepEqual(await one.json(), { buildId: build.id, state: "IN_PROGRESS", completed: false });
    assert.equal((await partStock(s.componentId)).currentStock, "4");

    const again = await assembleDesignator(
      jsonRequest(`${base}/builds/${build.id}/assignments/${first}/assemble`, "POST", s.readWrite),
      params({ buildId: build.id, assignmentId: first })
    );

    assert.equal(again.status, 409);
    assert.equal(await errorCode(again), "designator-already-assembled");

    for (const unitIndex of [1, 2]) {
      const unit = await assembleUnit(
        jsonRequest(`${base}/builds/${build.id}/assemble-unit`, "POST", s.readWrite, { unitIndex }),
        params({ buildId: build.id })
      );

      assert.equal(unit.status, 200, await unit.clone().text());
      assert.deepEqual(await unit.json(), {
        buildId: build.id,
        state: unitIndex === 2 ? "COMPLETED" : "IN_PROGRESS",
        completed: unitIndex === 2
      });
    }

    assert.deepEqual(await partStock(s.componentId), {
      currentStock: "1",
      reservedQty: "0",
      allocatedQty: "0",
      inProductionQty: "0"
    });
    assert.equal((await partStock(build.outputPart.id)).currentStock, "2");

    const notDeletable = await deleteBuild(
      jsonRequest(`${base}/builds/${build.id}`, "DELETE", s.readWrite),
      params({ buildId: build.id })
    );

    assert.equal(notDeletable.status, 409);
    assert.equal(await errorCode(notDeletable), "build-not-deletable");
  });

  test("whole-build allocations, cancel and delete; lines of another build are not found", async () => {
    const s = await setup("bld-cancel");
    const build = await createVia(s);
    const other = await createVia(s);

    const foreignLine = await setAllocations(
      jsonRequest(`${base}/builds/${build.id}/allocations`, "PUT", s.readWrite, {
        lines: [{ buildLineItemId: other.lines[0].id, entries: [] }]
      }),
      params({ buildId: build.id })
    );

    assert.equal(foreignLine.status, 404);
    assert.equal(await errorCode(foreignLine), "build-line-not-found");

    const tooMuch = await setAllocations(
      jsonRequest(`${base}/builds/${build.id}/allocations`, "PUT", s.readWrite, {
        lines: [
          { buildLineItemId: build.lines[0].id, entries: [{ partId: s.componentId, sourceLocationId: s.sourceId, quantity: 9 }] }
        ]
      }),
      params({ buildId: build.id })
    );

    assert.equal(tooMuch.status, 409);
    assert.equal(await errorCode(tooMuch), "insufficient-available-stock");

    const saved = await setAllocations(
      jsonRequest(`${base}/builds/${build.id}/allocations`, "PUT", s.readWrite, {
        lines: [
          { buildLineItemId: build.lines[0].id, entries: [{ partId: s.componentId, sourceLocationId: s.sourceId, quantity: 2 }] }
        ]
      }),
      params({ buildId: build.id })
    );

    assert.equal(saved.status, 200, await saved.clone().text());
    // 2 for this build, and 2 that creating the other build pre-allocated from stock, as the UI does.
    assert.equal((await partStock(s.componentId)).allocatedQty, "4");

    const invalid = await createBuild(
      jsonRequest(`${base}/builds`, "POST", s.readWrite, {
        designRevisionId: s.revisionId,
        targetQuantity: 0,
        outputLocationId: s.outputId
      })
    );

    assert.equal(invalid.status, 400);
    assert.equal(await errorCode(invalid), "invalid-input");

    const cancelled = await cancelBuild(
      jsonRequest(`${base}/builds/${build.id}/cancel`, "POST", s.readWrite),
      params({ buildId: build.id })
    );

    assert.equal(cancelled.status, 200, await cancelled.clone().text());
    assert.deepEqual(await cancelled.json(), { buildId: build.id, state: "CANCELLED" });
    assert.equal((await partStock(s.componentId)).allocatedQty, "2");

    const pick = await getPickList(
      new Request(`${base}/builds/${build.id}/pick-list`, { headers: bearer(s.readWrite) }),
      params({ buildId: build.id })
    );

    assert.equal(pick.status, 409);
    assert.equal(await errorCode(pick), "build-pick-list-unavailable");

    const deleted = await deleteBuild(
      jsonRequest(`${base}/builds/${build.id}`, "DELETE", s.readWrite),
      params({ buildId: build.id })
    );

    assert.equal(deleted.status, 200);
    assert.deepEqual(await deleted.json(), { buildId: build.id });

    const gone = await getBuild(
      new Request(`${base}/builds/${build.id}`, { headers: bearer(s.readWrite) }),
      params({ buildId: build.id })
    );

    assert.equal(gone.status, 404);
    assert.equal(await errorCode(gone), "build-not-found");
  });

  test("a read-only token reads but cannot change anything", async () => {
    const s = await setup("bld-ro");
    const build = await createVia(s);

    const read = await getBuild(
      new Request(`${base}/builds/${build.id}`, { headers: bearer(s.readOnly) }),
      params({ buildId: build.id })
    );

    assert.equal(read.status, 200);

    const listed = await listBuilds(new Request(`${base}/builds`, { headers: bearer(s.readOnly) }));

    assert.equal(listed.status, 200);

    const denied: Response[] = [
      await createBuild(
        jsonRequest(`${base}/builds`, "POST", s.readOnly, {
          designRevisionId: s.revisionId,
          targetQuantity: 1,
          outputLocationId: s.outputId
        })
      ),
      await getCreateOptions(new Request(`${base}/builds/create-options`, { headers: bearer(s.readOnly) })),
      await startBuild(jsonRequest(`${base}/builds/${build.id}/start`, "POST", s.readOnly), params({ buildId: build.id })),
      await cancelBuild(jsonRequest(`${base}/builds/${build.id}/cancel`, "POST", s.readOnly), params({ buildId: build.id })),
      await deleteBuild(jsonRequest(`${base}/builds/${build.id}`, "DELETE", s.readOnly), params({ buildId: build.id })),
      await setLineAllocations(
        jsonRequest(`${base}/builds/${build.id}/lines/${build.lines[0].id}/allocations`, "PUT", s.readOnly, { entries: [] }),
        params({ buildId: build.id, lineId: build.lines[0].id })
      )
    ];

    for (const response of denied) {
      assert.equal(response.status, 403);
      assert.equal(await errorCode(response), "permission-denied");
    }

    assert.equal((await prisma.build.findUniqueOrThrow({ where: { id: build.id } })).state, "ALLOCATING");
  });

  test("a token for workspace A neither sees nor changes workspace B's builds", async () => {
    const a = await setup("bld-iso-a");
    const b = await setup("bld-iso-b");
    const foreign = await createVia(b);

    const listed = await listBuilds(new Request(`${base}/builds`, { headers: bearer(a.readWrite) }));

    assert.deepEqual(((await listed.json()) as { items: unknown[] }).items, []);

    const responses: Response[] = [
      await getBuild(new Request(`${base}/builds/${foreign.id}`, { headers: bearer(a.readWrite) }), params({ buildId: foreign.id })),
      await startBuild(jsonRequest(`${base}/builds/${foreign.id}/start`, "POST", a.readWrite), params({ buildId: foreign.id })),
      await cancelBuild(jsonRequest(`${base}/builds/${foreign.id}/cancel`, "POST", a.readWrite), params({ buildId: foreign.id })),
      await deleteBuild(jsonRequest(`${base}/builds/${foreign.id}`, "DELETE", a.readWrite), params({ buildId: foreign.id })),
      await getPickList(new Request(`${base}/builds/${foreign.id}/pick-list`, { headers: bearer(a.readWrite) }), params({ buildId: foreign.id })),
      await setLineAllocations(
        jsonRequest(`${base}/builds/${foreign.id}/lines/${foreign.lines[0].id}/allocations`, "PUT", a.readWrite, { entries: [] }),
        params({ buildId: foreign.id, lineId: foreign.lines[0].id })
      )
    ];

    for (const response of responses) {
      assert.equal(response.status, 404);
      assert.equal(await errorCode(response), "build-not-found");
    }

    const foreignRevision = await createBuild(
      jsonRequest(`${base}/builds`, "POST", a.readWrite, {
        designRevisionId: b.revisionId,
        targetQuantity: 1,
        outputLocationId: a.outputId
      })
    );

    assert.equal(foreignRevision.status, 404);
    assert.equal(await errorCode(foreignRevision), "revision-not-found");

    const foreignPart = await getPartBuildAllocations(
      new Request(`${base}/parts/${b.componentId}/build-allocations`, { headers: bearer(a.readWrite) }),
      params({ id: b.componentId })
    );

    assert.equal(foreignPart.status, 404);
    assert.equal(await errorCode(foreignPart), "part-not-found");

    const foreignOutput = await getPartProductionBuilds(
      new Request(`${base}/parts/${foreign.outputPart.id}/production-builds`, { headers: bearer(a.readWrite) }),
      params({ id: foreign.outputPart.id })
    );

    assert.equal(foreignOutput.status, 404);
    assert.equal((await prisma.build.findUniqueOrThrow({ where: { id: foreign.id } })).state, "ALLOCATING");
  });
});

describe("MCP build tools", () => {
  test("annotations, and create → allocate → start → assemble through the tools", async () => {
    const s = await setup("bld-mcp");
    const client = await connect(s.readWrite);
    const { tools } = await client.listTools();
    const annotations = Object.fromEntries(tools.map((tool) => [tool.name, tool.annotations]));

    for (const name of [
      "list_builds",
      "get_build",
      "get_build_create_options",
      "get_build_pick_list",
      "get_build_assembly_list",
      "get_part_build_allocations",
      "get_part_production_builds"
    ]) {
      assert.equal(annotations[name]?.readOnlyHint, true, name);
    }

    for (const name of [
      "delete_build",
      "cancel_build",
      "set_build_line_allocations",
      "set_build_allocations",
      "reassign_build_designator"
    ]) {
      assert.equal(annotations[name]?.destructiveHint, true, name);
    }

    for (const name of ["create_build", "start_build", "assemble_build_designator", "assemble_build_unit"]) {
      assert.equal(annotations[name]?.readOnlyHint, false, name);
      assert.equal(annotations[name]?.destructiveHint, false, name);
    }

    const created = await client.callTool({
      name: "create_build",
      arguments: { designRevisionId: s.revisionId, targetQuantity: 1, outputLocationId: s.outputId }
    });

    assert.ok(!created.isError, JSON.stringify(created));

    const build = created.structuredContent as Build;
    const allocated = await client.callTool({
      name: "set_build_allocations",
      arguments: {
        buildId: build.id,
        lines: [
          { buildLineItemId: build.lines[0].id, entries: [{ partId: s.componentId, sourceLocationId: s.sourceId, quantity: 2 }] }
        ]
      }
    });

    assert.ok(!allocated.isError, JSON.stringify(allocated));

    const started = await client.callTool({ name: "start_build", arguments: { buildId: build.id } });

    assert.ok(!started.isError, JSON.stringify(started));

    const assembled = await client.callTool({
      name: "assemble_build_unit",
      arguments: { buildId: build.id, unitIndex: 1 }
    });

    assert.ok(!assembled.isError, JSON.stringify(assembled));
    assert.deepEqual(assembled.structuredContent, { buildId: build.id, state: "COMPLETED", completed: true });

    const fetched = await client.callTool({ name: "get_build", arguments: { buildId: build.id } });

    assert.equal((fetched.structuredContent as Build).units[0].status, "complete");
    assert.equal((await partStock(build.outputPart.id)).currentStock, "1");

    await client.close();
  });

  test("a read-only token cannot call a writing tool, nor reach another workspace", async () => {
    const a = await setup("bld-mcp-a");
    const b = await setup("bld-mcp-b");
    const foreign = await createVia(b);
    const client = await connect(a.readOnly);

    const denied = await client.callTool({
      name: "create_build",
      arguments: { designRevisionId: a.revisionId, targetQuantity: 1, outputLocationId: a.outputId }
    });

    assert.equal(denied.isError, true);
    assert.match(JSON.stringify(denied.content), /permission-denied/);

    const isolated = await client.callTool({ name: "get_build", arguments: { buildId: foreign.id } });

    assert.equal(isolated.isError, true);
    assert.match(JSON.stringify(isolated.content), /build-not-found/);

    await client.close();
  });
});
