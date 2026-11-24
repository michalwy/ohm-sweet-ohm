import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getOperationJsonSchemas,
  parseOperationInput
} from "../../src/server/api/operations";
import { listUnitsOperation } from "../../src/server/units/unitOperations";

describe("operation schemas: list_units", () => {
  test("accepts what the units list sends, and an empty input", () => {
    const parsed = parseOperationInput(listUnitsOperation, {
      cursor: null,
      sortBy: "symbol",
      sortDir: "desc"
    });

    assert.deepEqual(parsed, {
      ok: true,
      data: { cursor: null, sortBy: "symbol", sortDir: "desc" }
    });
    assert.deepEqual(parseOperationInput(listUnitsOperation, {}), { ok: true, data: {} });
  });

  test("rejects an unknown sort field, a page size out of range and a non-object", () => {
    const badSort = parseOperationInput(listUnitsOperation, { sortBy: "workspaceId" });

    assert.equal(badSort.ok, false);
    assert.ok(!badSort.ok);
    assert.equal(badSort.error.code, "invalid-input");
    assert.deepEqual(
      badSort.error.issues?.map((issue) => [issue.path, issue.code]),
      [["sortBy", "invalid_value"]]
    );

    const badPageSize = parseOperationInput(listUnitsOperation, { pageSize: 500, cursor: 7 });

    assert.ok(!badPageSize.ok);
    assert.deepEqual(
      badPageSize.error.issues?.map((issue) => issue.path).sort(),
      ["cursor", "pageSize"]
    );

    const notAnObject = parseOperationInput(listUnitsOperation, "units");

    assert.ok(!notAnObject.ok);
    assert.deepEqual(notAnObject.error.issues?.map((issue) => issue.path), [""]);
  });

  test("generates the input JSON Schema for OpenAPI 3.1 and MCP", () => {
    const { input } = getOperationJsonSchemas(listUnitsOperation);

    assert.equal(input.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.equal(input.type, "object");
    assert.equal(input.required, undefined, "every list input is optional");

    const properties = input.properties as Record<string, Record<string, unknown>>;

    assert.deepEqual(Object.keys(properties).sort(), ["cursor", "pageSize", "sortBy", "sortDir"]);
    assert.deepEqual(properties.sortBy.enum, ["name", "symbol", "allowsFraction"]);
    assert.equal(typeof properties.sortBy.description, "string");
    assert.deepEqual(properties.sortDir.enum, ["asc", "desc"]);

    const pageSize = (properties.pageSize.anyOf as Array<Record<string, unknown>>).find(
      (variant) => variant.type === "integer"
    );

    assert.deepEqual(
      { minimum: pageSize?.minimum, maximum: pageSize?.maximum },
      { minimum: 1, maximum: 100 }
    );
  });

  test("generates the output JSON Schema of a page of units", () => {
    const { output } = getOperationJsonSchemas(listUnitsOperation);
    const properties = output.properties as Record<string, Record<string, unknown>>;

    assert.deepEqual(
      [...(output.required as string[])].sort(),
      ["filteredCount", "items", "nextCursor", "totalCount"]
    );

    const item = properties.items.items as Record<string, unknown>;

    assert.deepEqual(
      [...(item.required as string[])].sort(),
      ["allowsFraction", "id", "name", "symbol"]
    );
    assert.equal(
      (item.properties as Record<string, Record<string, unknown>>).allowsFraction.type,
      "boolean"
    );
  });
});
