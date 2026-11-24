import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, test } from "node:test";

import { Validator } from "@seriousme/openapi-schema-validator";

import { readBearerToken } from "../../src/server/api/bearer";
import { errorStatusForCode } from "../../src/server/api/errorStatus";
import { buildOpenApiDocument } from "../../src/server/api/openapi";
import { getOperationJsonSchemas, parseOperationInput } from "../../src/server/api/operations";
import { readQueryInput } from "../../src/server/api/queryInput";
import { restEndpoints, type RestEndpoint } from "../../src/server/api/restEndpoints";
import { listUnitsOperation } from "../../src/server/units/unitOperations";

type OpenApiDocument = {
  openapi: string;
  paths: Record<string, Record<string, Record<string, unknown>>>;
};

describe("OpenAPI document", () => {
  test("validates as OpenAPI 3.1", async () => {
    const document = buildOpenApiDocument(restEndpoints);
    const validator = new Validator();
    const result = await validator.validate(document);

    assert.deepEqual(result.errors ?? [], []);
    assert.equal(result.valid, true);
    assert.equal(validator.version, "3.1");
  });

  test("an invalid document is rejected (the validator can go red)", async () => {
    const document = buildOpenApiDocument(restEndpoints) as Record<string, unknown>;
    delete document.info;

    const result = await new Validator().validate(document);

    assert.equal(result.valid, false);
  });

  test("describes GET /me and GET /workspace with the bearer scheme", () => {
    const document = buildOpenApiDocument(restEndpoints) as unknown as OpenApiDocument & {
      security: unknown;
      components: { securitySchemes: Record<string, { scheme: string }> };
    };

    assert.equal(document.openapi, "3.1.0");
    assert.equal(document.paths["/me"].get.operationId, "whoami");
    assert.equal(document.paths["/workspace"].get.operationId, "get_workspace");
    assert.deepEqual(document.security, [{ bearerAuth: [] }]);
    assert.equal(document.components.securitySchemes.bearerAuth.scheme, "bearer");
    assert.ok(!("403" in (document.paths["/me"].get.responses as object)));
    assert.ok("403" in (document.paths["/workspace"].get.responses as object));
  });

  test("a list operation's input becomes query parameters", () => {
    const endpoint: RestEndpoint = {
      method: "get",
      path: "/units",
      summary: "Units",
      tag: "Units",
      operation: listUnitsOperation
    };
    const document = buildOpenApiDocument([endpoint]) as unknown as OpenApiDocument;
    const parameters = document.paths["/units"].get.parameters as Array<{
      name: string;
      in: string;
      required: boolean;
    }>;

    assert.deepEqual(
      parameters.map(({ name, in: location, required }) => [name, location, required]),
      [
        ["cursor", "query", false],
        ["pageSize", "query", false],
        ["sortDir", "query", false],
        ["sortBy", "query", false]
      ]
    );
  });

  test("path placeholders become required path parameters, out of the body", () => {
    const document = buildOpenApiDocument(restEndpoints) as unknown as OpenApiDocument;
    const patch = document.paths["/units/{unitId}"].patch as {
      parameters: Array<{ name: string; in: string; required: boolean }>;
      requestBody: { content: Record<string, { schema: { properties: object; required?: string[] } }> };
    };

    assert.deepEqual(
      patch.parameters.map(({ name, in: location, required }) => [name, location, required]),
      [["unitId", "path", true]]
    );
    assert.deepEqual(
      Object.keys(patch.requestBody.content["application/json"].schema.properties),
      ["name", "symbol", "allowsFraction"]
    );

    const remove = document.paths["/units/{unitId}"].delete;

    assert.ok(!("requestBody" in remove), "a DELETE with only path parameters has no body");

    const attach = document.paths["/part-categories/{categoryId}/attributes/{attributeId}"].put as {
      parameters: Array<{ name: string }>;
    };

    assert.deepEqual(
      attach.parameters.map(({ name }) => name),
      ["categoryId", "attributeId"]
    );
  });

  test("every operation name is unique", () => {
    const names = restEndpoints.map((endpoint) => endpoint.operation.name);

    assert.deepEqual(names, [...new Set(names)]);
  });

  test("every endpoint has a route file exporting its method", () => {
    for (const endpoint of restEndpoints) {
      // A `{param}` placeholder is served by a `[param]` route segment.
      const file = path.join(
        "src/app/api/v1",
        endpoint.path.replace(/\{([^}]+)\}/g, "[$1]"),
        "route.ts"
      );

      assert.ok(existsSync(file), `${file} is missing`);
      assert.match(
        readFileSync(file, "utf8"),
        new RegExp(`export const ${endpoint.method.toUpperCase()}\\b`),
        `${file} does not export ${endpoint.method.toUpperCase()}`
      );
    }
  });
});

describe("query-string input", () => {
  const inputSchema = getOperationJsonSchemas(listUnitsOperation).input;

  test("converts numbers where the schema expects them and keeps cursors as strings", () => {
    const input = readQueryInput(
      new URLSearchParams("cursor=12345&pageSize=20&sortBy=symbol&sortDir=desc"),
      inputSchema
    );

    assert.deepEqual(input, { cursor: "12345", pageSize: 20, sortBy: "symbol", sortDir: "desc" });
    assert.equal(parseOperationInput(listUnitsOperation, input).ok, true);
  });

  test("a value that does not convert fails validation with a field issue", () => {
    const input = readQueryInput(new URLSearchParams("pageSize=ten"), inputSchema);
    const parsed = parseOperationInput(listUnitsOperation, input);

    assert.equal(parsed.ok, false);
    assert.equal(parsed.ok ? "" : parsed.error.issues?.[0]?.path, "pageSize");
  });

  test("an array parameter collects repeated values; booleans convert", () => {
    const schema = {
      type: "object",
      properties: { id: { type: "array", items: { type: "string" } }, archived: { type: "boolean" } }
    } as const;

    assert.deepEqual(
      readQueryInput(new URLSearchParams("id=a&id=b&archived=true"), schema),
      { id: ["a", "b"], archived: true }
    );
  });
});

describe("error statuses", () => {
  test("map domain codes to HTTP statuses", () => {
    assert.equal(errorStatusForCode("part-not-found"), 404);
    assert.equal(errorStatusForCode("workspace-not-found"), 404);
    assert.equal(errorStatusForCode("permission-denied"), 403);
    assert.equal(errorStatusForCode("workspace-permission-denied"), 403);
    assert.equal(errorStatusForCode("invalid-input"), 400);
    assert.equal(errorStatusForCode("invalid-quantity"), 400);
    assert.equal(errorStatusForCode("missing-required-fields"), 400);
    assert.equal(errorStatusForCode("category-name-required"), 400);
    assert.equal(errorStatusForCode("order-already-received"), 409);
  });
});

describe("bearer token", () => {
  test("reads only an Authorization: Bearer header", () => {
    assert.equal(readBearerToken(new Headers({ authorization: "Bearer oso_abc" })), "oso_abc");
    assert.equal(readBearerToken(new Headers({ authorization: "bearer  oso_abc " })), "oso_abc");
    assert.equal(readBearerToken(new Headers({ authorization: "Basic b3NvOmFiYw==" })), null);
    assert.equal(readBearerToken(new Headers({ authorization: "Bearer" })), null);
    assert.equal(readBearerToken(new Headers({ authorization: "Bearer a b" })), null);
    assert.equal(readBearerToken(new Headers({ cookie: "better-auth.session_token=x" })), null);
  });
});
