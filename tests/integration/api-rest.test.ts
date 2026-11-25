import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { z } from "zod";

import { prisma } from "../../src/server/db/prisma";
import { GET as getMe } from "../../src/app/api/v1/me/route";
import { GET as getWorkspace } from "../../src/app/api/v1/workspace/route";
import { GET as getOpenApi } from "../../src/app/api/v1/openapi.json/route";
import { GET as unknownEndpoint } from "../../src/app/api/v1/[...path]/route";
import { revokeApiToken } from "../../src/server/api-tokens/apiTokens";
import { implementOperation } from "../../src/server/api/execute";
import { defineOperation } from "../../src/server/api/operations";
import { restOperation } from "../../src/server/api/rest";
import { bearer, createApiTestWorkspace, createTestToken, uniqueSuffix } from "./apiFixtures";

const base = "http://localhost/api/v1";

type ErrorBody = { error: { code: string; message: string; issues?: Array<{ path: string }> } };

async function readError(response: Response) {
  const body = (await response.json()) as ErrorBody;
  assert.equal(typeof body.error.message, "string");
  return body.error;
}

/**
 * A test-only operation looking a unit up by id in the actor's workspace — the shape every area's
 * `get_<thing>` endpoint will have — to exercise 400 and 404 through the real adapter before any
 * area endpoint exists.
 */
const getUnitForTest = restOperation(
  implementOperation(
    defineOperation({
      name: "get_unit_for_test",
      description: "Test only.",
      permission: "units:read",
      input: z.object({ id: z.string().min(1).describe("The unit's id.") }),
      output: z.object({ id: z.string(), name: z.string() })
    }),
    async (actor, input) => {
      const unit = await prisma.unit.findFirst({
        where: { id: input.id, workspaceId: actor.workspace.id },
        select: { id: true, name: true }
      });

      if (!unit) {
        throw new Error("unit-not-found");
      }

      return unit;
    }
  )
);

async function createUnit(workspaceId: string) {
  const name = `unit-${uniqueSuffix()}`;

  return prisma.unit.create({
    data: { workspaceId, name, normalizedName: name, symbol: "u", allowsFraction: false }
  });
}

describe("REST API /api/v1", () => {
  test("GET /me returns the token's user, workspace and effective permissions", async () => {
    const { workspace, owner } = await createApiTestWorkspace("rest-me");
    const { value } = await createTestToken(owner.id, workspace.id, { access: "read-only" });

    const response = await getMe(new Request(`${base}/me`, { headers: bearer(value) }));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");

    const body = await response.json();

    assert.deepEqual(body.user, { id: owner.id, name: owner.name, email: owner.email });
    assert.deepEqual(body.workspace, {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug
    });
    assert.ok(body.permissions.length > 0);
    assert.ok(body.permissions.every((key: string) => key.endsWith(":read")));
    assert.ok(body.permissions.includes("workspace:read"));
  });

  test("GET /workspace returns the token's workspace", async () => {
    const { workspace, owner } = await createApiTestWorkspace("rest-ws");
    const { value } = await createTestToken(owner.id, workspace.id, { access: "read-write" });

    const response = await getWorkspace(
      new Request(`${base}/workspace`, { headers: bearer(value) })
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      primaryCurrency: workspace.primaryCurrency,
      defaultPriceEntryMode: workspace.defaultPriceEntryMode,
      defaultTaxRate: null,
      activeSupplierProvider: null,
      defaultLocationId: null,
      createdAt: workspace.createdAt.toISOString(),
      updatedAt: workspace.updatedAt.toISOString()
    });
  });

  test("401 for a missing, malformed, unknown or revoked token, and for cookies alone", async () => {
    const { workspace, owner } = await createApiTestWorkspace("rest-401");
    const { tokenId, value } = await createTestToken(owner.id, workspace.id, {
      access: "read-only"
    });

    const unknown = `oso_${"A".repeat(43)}`;
    const headerSets: HeadersInit[] = [
      {},
      { authorization: `Basic ${Buffer.from(`x:${value}`).toString("base64")}` },
      { authorization: "Bearer not-a-token" },
      bearer(unknown),
      { cookie: `better-auth.session_token=${value}` }
    ];

    for (const headers of headerSets) {
      const response = await getMe(new Request(`${base}/me`, { headers }));

      assert.equal(response.status, 401, JSON.stringify(headers));
      assert.match(response.headers.get("www-authenticate") ?? "", /^Bearer/);
      assert.equal((await readError(response)).code, "unauthorized");
    }

    await revokeApiToken(owner.id, tokenId);

    const revoked = await getMe(new Request(`${base}/me`, { headers: bearer(value) }));

    assert.equal(revoked.status, 401);
  });

  test("403 when the token lacks the endpoint's permission; /me needs none", async () => {
    const { workspace, owner } = await createApiTestWorkspace("rest-403");
    const { value } = await createTestToken(owner.id, workspace.id, {
      access: "custom",
      permissions: ["parts:read"]
    });

    const denied = await getWorkspace(new Request(`${base}/workspace`, { headers: bearer(value) }));

    assert.equal(denied.status, 403);
    assert.equal((await readError(denied)).code, "permission-denied");

    const me = await getMe(new Request(`${base}/me`, { headers: bearer(value) }));

    assert.equal(me.status, 200);
    assert.deepEqual((await me.json()).permissions, ["parts:read"]);
  });

  test("404 for a record outside the token's workspace; 200 inside it", async () => {
    const home = await createApiTestWorkspace("rest-404-home");
    const other = await createApiTestWorkspace("rest-404-other");
    const { value } = await createTestToken(home.owner.id, home.workspace.id, {
      access: "read-only"
    });
    const ownUnit = await createUnit(home.workspace.id);
    const foreignUnit = await createUnit(other.workspace.id);

    const foreign = await getUnitForTest(
      new Request(`${base}/units/x?id=${foreignUnit.id}`, { headers: bearer(value) })
    );

    assert.equal(foreign.status, 404);
    assert.equal((await readError(foreign)).code, "unit-not-found");

    const own = await getUnitForTest(
      new Request(`${base}/units/x?id=${ownUnit.id}`, { headers: bearer(value) })
    );

    assert.equal(own.status, 200);
    assert.deepEqual(await own.json(), { id: ownUnit.id, name: ownUnit.name });
  });

  test("400 with field details for invalid input, and for a body that is not JSON", async () => {
    const { workspace, owner } = await createApiTestWorkspace("rest-400");
    const { value } = await createTestToken(owner.id, workspace.id, { access: "read-only" });

    const missing = await getUnitForTest(
      new Request(`${base}/units/x`, { headers: bearer(value) })
    );

    assert.equal(missing.status, 400);

    const error = await readError(missing);

    assert.equal(error.code, "invalid-input");
    assert.deepEqual(error.issues?.map((issue) => issue.path), ["id"]);

    const notJson = await getUnitForTest(
      new Request(`${base}/units/x`, {
        method: "POST",
        headers: { ...bearer(value), "content-type": "application/json" },
        body: "{not json"
      })
    );

    assert.equal(notJson.status, 400);
    assert.equal((await readError(notJson)).code, "invalid-json");
  });

  test("an unknown path answers the JSON 404; the OpenAPI document is public", async () => {
    const unknown = unknownEndpoint();

    assert.equal(unknown.status, 404);
    assert.equal((await readError(unknown)).code, "endpoint-not-found");

    const document = getOpenApi();

    assert.equal(document.status, 200);
    assert.equal((await document.json()).openapi, "3.1.0");
  });
});
