import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { POST as mcpPost } from "../../src/app/api/mcp/route";
import { POST as createPart } from "../../src/app/api/v1/parts/route";
import { POST as matchingSuggestions } from "../../src/app/api/v1/supplier-matching-suggestions/route";
import { GET as supplierAttributes } from "../../src/app/api/v1/supplier-parts/attributes/route";
import { GET as searchSupplierParts } from "../../src/app/api/v1/supplier-parts/route";
import { prisma } from "../../src/server/db/prisma";
import {
  searchDigiKeyParts,
  upsertWorkspaceDigiKeyIntegration
} from "../../src/server/integrations/digikey";
import { setWorkspaceActiveSupplierProvider } from "../../src/server/integrations/providerSettings";
import {
  fetchTmeProductParameters,
  upsertWorkspaceTmeIntegration
} from "../../src/server/integrations/tme";
import { createAttribute } from "../../src/server/parts/attributeMutations";
import { createPartCategory } from "../../src/server/parts/categories";
import {
  ensureDefaultUnitsForWorkspace,
  getDefaultPartUnitId
} from "../../src/server/units/defaultUnits";
import { bearer, createApiTestWorkspace, createTestToken, uniqueSuffix } from "./apiFixtures";

/**
 * Supplier lookup in the API and MCP (#285). DigiKey and TME are replaced by a stub of `fetch`
 * that records every request, so the tests can check that the API sends exactly what the UI's
 * code path sends (the owner's guardrail decision in #285) and never returns the credentials.
 */

const base = "http://localhost/api/v1";
const DIGIKEY_SECRET = "digikey-secret-value";
const TME_SECRET = "tme-secret-value";

type RecordedRequest = { url: string; method: string; headers: Record<string, string>; body: string | null };

const recorded: RecordedRequest[] = [];
const realFetch = globalThis.fetch;

async function supplierStub(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const body = init?.body === undefined || init.body === null ? null : String(init.body);

  recorded.push({
    url,
    method: init?.method ?? "GET",
    headers: Object.fromEntries(new Headers(init?.headers).entries()),
    body
  });

  const json = (value: unknown) =>
    new Response(JSON.stringify(value), { status: 200, headers: { "content-type": "application/json" } });

  if (url.includes("digikey.com") && url.includes("token")) {
    return json({ access_token: "digikey-access-token" });
  }

  if (url.includes("digikey.com")) {
    return json({
      Products: [
        {
          Manufacturer: { Name: "Texas Instruments" },
          ManufacturerProductNumber: "NE555P",
          Description: { ProductDescription: "IC OSC SINGLE TIMER 100KHZ 8-DIP" }
        }
      ],
      ProductsCount: 1
    });
  }

  if (url.startsWith("https://api.tme.eu/auth/token")) {
    return json({ access_token: "tme-access-token" });
  }

  if (url.startsWith("https://api.tme.eu/products/parameters")) {
    return json({
      status: "OK",
      data: {
        elements: [
          {
            symbol: "NE555P",
            parameters: { elements: [{ name: "Frequency", values: [{ value: "100kHz" }] }] }
          }
        ]
      }
    });
  }

  return new Response("not stubbed", { status: 500 });
}

before(() => {
  globalThis.fetch = supplierStub as typeof fetch;
});

after(() => {
  globalThis.fetch = realFetch;
});

async function takeRecorded<T>(action: () => Promise<T>) {
  recorded.length = 0;
  const result = await action();
  return { result, requests: recorded.splice(0) };
}

async function createSupplierWorkspace(label: string, provider: "digikey" | "tme" | null) {
  const { workspace, owner } = await createApiTestWorkspace(label);

  await ensureDefaultUnitsForWorkspace(prisma, workspace.id);

  const unitId = await getDefaultPartUnitId(prisma, workspace.id);
  assert.ok(unitId);

  const timers = await createPartCategory({
    workspaceId: workspace.id,
    parentId: null,
    name: "Timers",
    isAssignable: true
  });
  const frequency = await createAttribute({
    workspaceId: workspace.id,
    name: "Frequency",
    type: "QUANTITY",
    baseUnitSymbol: "Hz"
  });

  if (provider === "digikey") {
    await upsertWorkspaceDigiKeyIntegration({
      workspaceId: workspace.id,
      clientId: "digikey-client",
      clientSecret: DIGIKEY_SECRET
    });
  }

  if (provider === "tme") {
    await upsertWorkspaceTmeIntegration({
      workspaceId: workspace.id,
      clientId: "tme-client",
      clientSecret: TME_SECRET
    });
  }

  if (provider) {
    await setWorkspaceActiveSupplierProvider({ workspaceId: workspace.id, provider });
  }

  const { value: readWrite } = await createTestToken(owner.id, workspace.id, { access: "read-write" });
  const { value: readOnly } = await createTestToken(owner.id, workspace.id, { access: "read-only" });

  return {
    workspace,
    unitId: unitId as string,
    timersId: timers.id,
    frequencyId: frequency.id,
    readWrite,
    readOnly
  };
}

function get(url: string, token: string) {
  return new Request(url, { headers: bearer(token) });
}

function post(url: string, token: string, body: unknown) {
  return new Request(url, {
    method: "POST",
    headers: { ...bearer(token), "content-type": "application/json" },
    body: JSON.stringify(body)
  });
}

async function connect(token: string) {
  const transport = new StreamableHTTPClientTransport(new URL("http://localhost/api/mcp"), {
    requestInit: { headers: bearer(token) },
    fetch: async (input, init) => mcpPost(new Request(input, init))
  });
  const client = new Client({ name: "oso-supplier-test", version: "1.0.0" });

  await client.connect(transport);

  return client;
}

function toolError(result: unknown) {
  const [content] = (result as { content: Array<{ text: string }> }).content;
  return (JSON.parse(content.text) as { error: { code: string } }).error;
}

describe("supplier lookup REST API", () => {
  test("searches DigiKey with exactly the request the add-part dialog makes", async () => {
    const ws = await createSupplierWorkspace("supplier-digikey", "digikey");

    // The add-part dialog's search: the same provider function, with its page size of 10.
    const ui = await takeRecorded(() =>
      searchDigiKeyParts({ workspaceId: ws.workspace.id, query: "NE555P", limit: 10, offset: 0 })
    );
    const api = await takeRecorded(() =>
      searchSupplierParts(get(`${base}/supplier-parts?query=NE555P&offset=0`, ws.readWrite))
    );

    assert.equal(api.result.status, 200);
    assert.equal(api.requests.length, 2);
    assert.deepEqual(api.requests, ui.requests);

    const text = await api.result.text();

    assert.ok(!text.includes(DIGIKEY_SECRET));
    assert.ok(!text.includes("digikey-access-token"));

    const page = JSON.parse(text) as {
      provider: string;
      items: Array<{ manufacturerName: string; catalogNumber: string; sourceAttributes: unknown[] }>;
      nextOffset: number | null;
    };

    assert.equal(page.provider, "digikey");
    assert.deepEqual(
      page.items.map((item) => [item.manufacturerName, item.catalogNumber]),
      [["Texas Instruments", "NE555P"]]
    );
    assert.equal(page.nextOffset, null);

    // DigiKey has no attribute lookup: the search result's attributes are the ones to use.
    const attributes = await takeRecorded(() =>
      supplierAttributes(get(`${base}/supplier-parts/attributes?catalogNumber=NE555P`, ws.readWrite))
    );

    assert.equal(attributes.result.status, 200);
    assert.deepEqual(await attributes.result.json(), { provider: "digikey", sourceAttributes: null });
    assert.equal(attributes.requests.length, 0);
  });

  test("reads a TME part's attributes with exactly the request the add-part dialog makes", async () => {
    const ws = await createSupplierWorkspace("supplier-tme", "tme");

    const ui = await takeRecorded(() =>
      fetchTmeProductParameters({ workspaceId: ws.workspace.id, symbol: "NE555P" })
    );
    const api = await takeRecorded(() =>
      supplierAttributes(get(`${base}/supplier-parts/attributes?catalogNumber=NE555P`, ws.readWrite))
    );

    assert.equal(api.result.status, 200);
    assert.equal(api.requests.length, 2);
    assert.deepEqual(api.requests, ui.requests);

    const text = await api.result.text();

    assert.ok(!text.includes(TME_SECRET));
    assert.deepEqual(JSON.parse(text), {
      provider: "tme",
      sourceAttributes: [{ name: "Frequency", value: "100kHz", unit: null }]
    });
  });

  test("answers missing-credentials when no supplier is active, and 502 when it fails", async () => {
    const none = await createSupplierWorkspace("supplier-none", null);
    const missing = await takeRecorded(() =>
      searchSupplierParts(get(`${base}/supplier-parts?query=NE555P`, none.readWrite))
    );

    assert.equal(missing.result.status, 400);
    assert.equal(((await missing.result.json()) as { error: { code: string } }).error.code, "missing-credentials");
    assert.equal(missing.requests.length, 0);

    const ws = await createSupplierWorkspace("supplier-down", "digikey");

    globalThis.fetch = (async () => new Response("down", { status: 503 })) as typeof fetch;

    try {
      const failed = await searchSupplierParts(get(`${base}/supplier-parts?query=NE555P`, ws.readWrite));

      assert.equal(failed.status, 502);
      assert.equal(((await failed.json()) as { error: { code: string } }).error.code, "token-request-failed");
    } finally {
      globalThis.fetch = supplierStub as typeof fetch;
    }
  });

  test("refuses a page larger than the dialog's", async () => {
    const ws = await createSupplierWorkspace("supplier-limit", "digikey");
    const response = await searchSupplierParts(
      get(`${base}/supplier-parts?query=NE555P&limit=11`, ws.readWrite)
    );

    assert.equal(response.status, 400);
    assert.equal(((await response.json()) as { error: { code: string } }).error.code, "invalid-input");
  });

  test("records accepted matches through create_part and suggests them next time", async () => {
    const ws = await createSupplierWorkspace("supplier-matching", "digikey");
    const supplierPart = {
      provider: "digikey",
      sourceManufacturerName: "Texas Instruments",
      sourceCategory: "Integrated Circuits (ICs) » Clock/Timing » Programmable Timers and Oscillators",
      sourceAttributes: [
        { name: "Frequency", value: "100kHz", unit: null },
        { name: "Mounting Type", value: "Through Hole", unit: null }
      ]
    };

    const before = await takeRecorded(() =>
      matchingSuggestions(post(`${base}/supplier-matching-suggestions`, ws.readWrite, supplierPart))
    );

    assert.equal(before.result.status, 200);
    assert.equal(before.requests.length, 0, "suggestions never call the supplier");

    const empty = (await before.result.json()) as {
      sourceCategoryKey: string;
      sourceManufacturerKey: string;
      suggestedTargetCategoryId: string | null;
      suggestedTargetManufacturerName: string | null;
      attributeRows: Array<{ sourceAttributeKey: string; suggestedTargetAttributeId: string | null }>;
    };

    assert.equal(empty.suggestedTargetCategoryId, null);
    assert.equal(empty.suggestedTargetManufacturerName, null);
    assert.equal(empty.attributeRows.length, 2);

    const created = await createPart(
      post(`${base}/parts`, ws.readWrite, {
        catalogNumber: "NE555P",
        manufacturerName: "TI",
        unitId: ws.unitId,
        primaryCategoryId: ws.timersId,
        supplierMatching: {
          provider: "digikey",
          sourceCategoryKey: empty.sourceCategoryKey,
          sourceManufacturerKey: empty.sourceManufacturerKey,
          targetCategoryId: ws.timersId,
          attributeMappings: [
            { sourceAttributeKey: empty.attributeRows[0].sourceAttributeKey, targetAttributeId: ws.frequencyId }
          ]
        }
      })
    );

    assert.equal(created.status, 200, await created.clone().text());

    const category = (await (
      await matchingSuggestions(post(`${base}/supplier-matching-suggestions`, ws.readWrite, supplierPart))
    ).json()) as typeof empty;

    assert.equal(category.suggestedTargetCategoryId, ws.timersId);
    assert.equal(category.suggestedTargetManufacturerName, "TI");

    const scoped = (await (
      await matchingSuggestions(
        post(`${base}/supplier-matching-suggestions`, ws.readWrite, {
          ...supplierPart,
          targetCategoryId: ws.timersId
        })
      )
    ).json()) as typeof empty;

    assert.deepEqual(
      scoped.attributeRows.map((row) => row.suggestedTargetAttributeId),
      [ws.frequencyId, null]
    );
  });

  test("a read-only token is refused", async () => {
    const ws = await createSupplierWorkspace("supplier-denied", "digikey");

    const search = await takeRecorded(() =>
      searchSupplierParts(get(`${base}/supplier-parts?query=NE555P`, ws.readOnly))
    );

    assert.equal(search.result.status, 403);
    assert.equal(search.requests.length, 0, "a refused call never reaches the supplier");

    const attributes = await supplierAttributes(
      get(`${base}/supplier-parts/attributes?catalogNumber=NE555P`, ws.readOnly)
    );

    assert.equal(attributes.status, 403);

    const suggestions = await matchingSuggestions(
      post(`${base}/supplier-matching-suggestions`, ws.readOnly, {
        provider: "digikey",
        sourceCategory: null,
        sourceAttributes: []
      })
    );

    assert.equal(suggestions.status, 403);
  });

  test("a token for one workspace uses neither another's supplier nor its matches", async () => {
    const a = await createSupplierWorkspace("supplier-iso-a", "digikey");
    const b = await createSupplierWorkspace("supplier-iso-b", null);
    const supplierPart = {
      provider: "digikey",
      sourceManufacturerName: "Texas Instruments",
      sourceCategory: "Timers",
      sourceAttributes: [{ name: "Frequency", value: "100kHz", unit: null }]
    };
    const keys = (await (
      await matchingSuggestions(post(`${base}/supplier-matching-suggestions`, a.readWrite, supplierPart))
    ).json()) as { sourceCategoryKey: string; sourceManufacturerKey: string; attributeRows: Array<{ sourceAttributeKey: string }> };

    const learned = await createPart(
      post(`${base}/parts`, a.readWrite, {
        catalogNumber: `NE555-${uniqueSuffix()}`,
        manufacturerName: "TI",
        unitId: a.unitId,
        primaryCategoryId: a.timersId,
        supplierMatching: {
          provider: "digikey",
          sourceCategoryKey: keys.sourceCategoryKey,
          sourceManufacturerKey: keys.sourceManufacturerKey,
          targetCategoryId: a.timersId,
          attributeMappings: [
            { sourceAttributeKey: keys.attributeRows[0].sourceAttributeKey, targetAttributeId: a.frequencyId }
          ]
        }
      })
    );

    assert.equal(learned.status, 200);

    // B has no supplier of its own: A's credentials are never used for it.
    const search = await takeRecorded(() =>
      searchSupplierParts(get(`${base}/supplier-parts?query=NE555P`, b.readWrite))
    );

    assert.equal(search.result.status, 400);
    assert.equal(search.requests.length, 0);

    // A's learned matches are not B's.
    const bSuggestions = (await (
      await matchingSuggestions(post(`${base}/supplier-matching-suggestions`, b.readWrite, supplierPart))
    ).json()) as { suggestedTargetCategoryId: string | null; suggestedTargetManufacturerName: string | null };

    assert.equal(bSuggestions.suggestedTargetCategoryId, null);
    assert.equal(bSuggestions.suggestedTargetManufacturerName, null);

    // B cannot record matches to A's category or attributes.
    const baseBody = {
      catalogNumber: `NE555-${uniqueSuffix()}`,
      manufacturerName: "TI",
      unitId: b.unitId,
      supplierMatching: {
        provider: "digikey",
        sourceCategoryKey: keys.sourceCategoryKey,
        sourceManufacturerKey: keys.sourceManufacturerKey,
        targetCategoryId: a.timersId,
        attributeMappings: []
      }
    };
    const foreignCategory = await createPart(post(`${base}/parts`, b.readWrite, baseBody));

    assert.equal(foreignCategory.status, 404);
    assert.equal(((await foreignCategory.json()) as { error: { code: string } }).error.code, "category-not-found");

    const foreignAttribute = await createPart(
      post(`${base}/parts`, b.readWrite, {
        ...baseBody,
        supplierMatching: {
          ...baseBody.supplierMatching,
          targetCategoryId: null,
          attributeMappings: [
            { sourceAttributeKey: keys.attributeRows[0].sourceAttributeKey, targetAttributeId: a.frequencyId }
          ]
        }
      })
    );

    assert.equal(foreignAttribute.status, 404);
    assert.equal(((await foreignAttribute.json()) as { error: { code: string } }).error.code, "attribute-not-found");
    assert.equal(
      await prisma.supplierAttributeMappingStat.count({ where: { workspaceId: b.workspace.id } }),
      0
    );
  });
});

describe("supplier lookup MCP tools", () => {
  test("the tools search, read attributes and suggest, with the same permission and isolation", async () => {
    const ws = await createSupplierWorkspace("supplier-mcp", "tme");
    const client = await connect(ws.readWrite);
    const { tools } = await client.listTools();
    const byName = new Map(tools.map((tool) => [tool.name, tool]));

    assert.equal(byName.get("search_supplier_parts")?.annotations?.readOnlyHint, true);
    assert.equal(byName.get("search_supplier_parts")?.annotations?.openWorldHint, true);
    assert.equal(byName.get("get_supplier_part_attributes")?.annotations?.openWorldHint, true);
    assert.equal(byName.get("get_supplier_matching_suggestions")?.annotations?.readOnlyHint, true);
    assert.equal(byName.get("get_supplier_matching_suggestions")?.annotations?.openWorldHint, false);
    assert.ok(
      byName.get("create_part")?.inputSchema.properties &&
        "supplierMatching" in (byName.get("create_part")?.inputSchema.properties ?? {})
    );

    const attributes = await takeRecorded(() =>
      client.callTool({ name: "get_supplier_part_attributes", arguments: { catalogNumber: "NE555P" } })
    );

    assert.equal(attributes.result.isError, undefined);
    assert.deepEqual(attributes.result.structuredContent, {
      provider: "tme",
      sourceAttributes: [{ name: "Frequency", value: "100kHz", unit: null }]
    });
    assert.ok(!JSON.stringify(attributes.result).includes(TME_SECRET));

    const suggestions = await client.callTool({
      name: "get_supplier_matching_suggestions",
      arguments: {
        provider: "tme",
        sourceCategory: "Timers",
        sourceAttributes: [{ name: "Frequency", value: "100kHz", unit: null }]
      }
    });

    assert.equal(suggestions.isError, undefined);
    assert.equal(
      (suggestions.structuredContent as { attributeRows: unknown[] }).attributeRows.length,
      1
    );

    await client.close();

    const readOnly = await connect(ws.readOnly);
    const denied = await takeRecorded(() =>
      readOnly.callTool({ name: "search_supplier_parts", arguments: { query: "NE555P" } })
    );

    assert.equal(denied.result.isError, true);
    assert.equal(toolError(denied.result).code, "permission-denied");
    assert.equal(denied.requests.length, 0);

    await readOnly.close();

    const other = await createSupplierWorkspace("supplier-mcp-other", null);
    const otherClient = await connect(other.readWrite);
    const missing = await otherClient.callTool({
      name: "search_supplier_parts",
      arguments: { query: "NE555P" }
    });

    assert.equal(missing.isError, true);
    assert.equal(toolError(missing).code, "missing-credentials");

    await otherClient.close();
  });
});
