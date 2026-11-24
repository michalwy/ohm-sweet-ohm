import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";

import { POST as mcpPost } from "../../src/app/api/mcp/route";
import { implementOperation } from "../../src/server/api/execute";
import { defineOperation } from "../../src/server/api/operations";
import { serverActionCoverage } from "../../src/server/mcp/coverage";
import { handleMcpRequest } from "../../src/server/mcp/server";
import { defineMcpTool, mcpTools, type McpTool } from "../../src/server/mcp/tools";
import { bearer, createApiTestWorkspace, createTestToken } from "./apiFixtures";

const endpoint = new URL("http://localhost/api/mcp");

/**
 * A real MCP client (the official SDK's Streamable HTTP client) whose HTTP requests go straight to
 * the route handler, as a remote client's would through the app.
 */
async function connect(token: string, tools?: readonly McpTool[]) {
  const transport = new StreamableHTTPClientTransport(endpoint, {
    requestInit: { headers: bearer(token) },
    fetch: async (input, init) => {
      const request = new Request(input, init);
      return tools ? handleMcpRequest(request, { tools }) : mcpPost(request);
    }
  });
  const client = new Client({ name: "oso-integration-test", version: "1.0.0" });

  await client.connect(transport);

  return client;
}

const unitsTool = defineMcpTool(
  "Units probe",
  implementOperation(
    defineOperation({
      name: "units_probe_for_test",
      description: "Test only: needs units:read.",
      permission: "units:read",
      input: z.object({}),
      output: z.object({ ok: z.boolean() })
    }),
    async () => ({ ok: true })
  ),
  { readOnly: true }
);

describe("MCP server /api/mcp", () => {
  test("initialize, list tools and call whoami with a valid token", async () => {
    const { workspace, owner } = await createApiTestWorkspace("mcp-whoami");
    const { value } = await createTestToken(owner.id, workspace.id, { access: "read-only" });
    const client = await connect(value);

    assert.equal(client.getServerVersion()?.name, "ohm-sweet-ohm");
    assert.match(client.getInstructions() ?? "", /whoami/);

    const { tools } = await client.listTools();
    const whoami = tools.find((tool) => tool.name === "whoami");

    assert.deepEqual(
      tools.map((tool) => tool.name),
      mcpTools.map((tool) => tool.implementation.operation.name)
    );
    assert.ok(whoami);
    assert.equal(whoami.annotations?.readOnlyHint, true);
    assert.equal(whoami.inputSchema.type, "object");
    assert.equal(whoami.outputSchema?.type, "object");

    const result = await client.callTool({ name: "whoami", arguments: {} });

    assert.ok(!result.isError, JSON.stringify(result));

    const structured = result.structuredContent as {
      user: { id: string };
      workspace: { id: string; slug: string };
      permissions: string[];
    };

    assert.equal(structured.user.id, owner.id);
    assert.equal(structured.workspace.id, workspace.id);
    assert.equal(structured.workspace.slug, workspace.slug);
    assert.ok(structured.permissions.every((key) => key.endsWith(":read")));

    await client.close();
  });

  test("an invalid token is rejected before any MCP message is handled", async () => {
    const invalid = `oso_${"B".repeat(43)}`;

    await assert.rejects(connect(invalid));

    const response = await mcpPost(
      new Request(endpoint, {
        method: "POST",
        headers: {
          ...bearer(invalid),
          "content-type": "application/json",
          accept: "application/json, text/event-stream"
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })
      })
    );

    assert.equal(response.status, 401);
    assert.match(response.headers.get("www-authenticate") ?? "", /^Bearer/);
    assert.equal((await response.json()).error.code, "unauthorized");

    const noToken = await mcpPost(new Request(endpoint, { method: "POST", body: "{}" }));

    assert.equal(noToken.status, 401);
  });

  test("a tool needing a permission the token lacks returns a permission error", async () => {
    const { workspace, owner } = await createApiTestWorkspace("mcp-403");
    const { value } = await createTestToken(owner.id, workspace.id, {
      access: "custom",
      permissions: ["parts:read"]
    });
    const client = await connect(value, [...mcpTools, unitsTool]);

    const denied = await client.callTool({ name: "units_probe_for_test", arguments: {} });

    assert.equal(denied.isError, true);

    const [content] = denied.content as Array<{ type: string; text: string }>;

    assert.equal(JSON.parse(content.text).error.code, "permission-denied");

    const allowed = await client.callTool({ name: "whoami", arguments: {} });

    assert.ok(!allowed.isError);
    assert.deepEqual((allowed.structuredContent as { permissions: string[] }).permissions, [
      "parts:read"
    ]);

    await client.close();
  });

  test("invalid tool arguments come back as an invalid-input tool error", async () => {
    const { workspace, owner } = await createApiTestWorkspace("mcp-400");
    const { value } = await createTestToken(owner.id, workspace.id, { access: "read-only" });
    const strictTool = defineMcpTool(
      "Strict probe",
      implementOperation(
        defineOperation({
          name: "strict_probe_for_test",
          description: "Test only.",
          permission: null,
          input: z.object({ count: z.number().int().describe("A count.") }),
          output: z.object({ count: z.number() })
        }),
        async (_actor, input) => input
      ),
      { readOnly: true }
    );
    const client = await connect(value, [strictTool]);

    const result = await client.callTool({
      name: "strict_probe_for_test",
      arguments: { count: "three" }
    });

    assert.equal(result.isError, true);

    const [content] = result.content as Array<{ type: string; text: string }>;
    const error = JSON.parse(content.text).error;

    assert.equal(error.code, "invalid-input");
    assert.equal(error.issues[0].path, "count");

    await client.close();
  });
});

describe("MCP coverage (#276)", () => {
  test("every coverage entry that names a tool names one the registry offers", () => {
    // The unit check (tests/unit/mcpCoverage.test.ts) cannot load the registry, which is
    // server-only; this closes the loop: an action mapped to a tool really has that tool.
    const registered = new Set(mcpTools.map((tool) => tool.implementation.operation.name));
    const missing = Object.entries(serverActionCoverage).flatMap(([file, entries]) =>
      Object.entries(entries).flatMap(([name, entry]) =>
        "tool" in entry && !registered.has(entry.tool) ? [`${file}#${name} -> ${entry.tool}`] : []
      )
    );

    assert.deepEqual(missing, []);
  });
});
