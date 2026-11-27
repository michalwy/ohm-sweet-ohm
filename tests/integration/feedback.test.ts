import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { POST as mcpPost } from "../../src/app/api/mcp/route";
import { updateFeedbackAs } from "../../src/server/admin/adminActionCore";
import { resolveTokenActor } from "../../src/server/access-control/actor";
import { executeOperation } from "../../src/server/api/execute";
import { prisma } from "../../src/server/db/prisma";
import { adminListFeedbackImplementation } from "../../src/server/feedback/feedbackApi";
import { FEEDBACK_RATE_LIMIT } from "../../src/server/feedback/feedbackPolicy";
import { getFeedbackReport, listFeedbackReports, submitFeedback } from "../../src/server/feedback/feedbackReports";
import { bearer, createApiTestWorkspace, createTestToken, uniqueSuffix } from "./apiFixtures";

/** In-app feedback (#325): saving reports, the admin panel's triage and the admin MCP tools. */

const endpoint = new URL("http://localhost/api/mcp");

async function connect(token: string) {
  const transport = new StreamableHTTPClientTransport(endpoint, {
    requestInit: { headers: bearer(token) },
    fetch: async (input, init) => mcpPost(new Request(input, init))
  });
  const client = new Client({ name: "oso-feedback-test", version: "1.0.0" });

  await client.connect(transport);

  return client;
}

async function createAdmin() {
  const { workspace, owner } = await createApiTestWorkspace("feedback-admin");

  await prisma.user.update({ where: { id: owner.id }, data: { isInstanceAdmin: true } });

  return { workspace, admin: owner };
}

const context = {
  path: "/w/lab/parts?q=10k&token=secret#row",
  userAgent: "Mozilla/5.0 (X11; Linux x86_64) Test",
  language: "pl-PL",
  timeZone: "Europe/Warsaw",
  theme: "dark",
  clientTime: "2026-11-27T22:00:00.000Z",
  viewport: { width: 1440, height: 900 },
  recentErrors: ["TypeError: x is undefined"]
};

/** The newest report whose message is `message`. */
async function findReport(message: string) {
  return prisma.feedbackReport.findFirstOrThrow({ where: { message }, orderBy: { createdAt: "desc" } });
}

describe("in-app feedback (#325)", () => {
  test("a signed-in report is saved with its context, reporter and workspace", async () => {
    const { workspace, owner } = await createApiTestWorkspace("feedback-signed-in");
    const message = `The parts list is slow ${uniqueSuffix()}`;

    await submitFeedback({
      userId: owner.id,
      clientKey: "203.0.113.1",
      submission: { kind: "problem", message, workspaceSlug: workspace.slug, context }
    });

    const row = await findReport(message);
    const report = await getFeedbackReport(row.id);

    assert.equal(report.kind, "problem");
    assert.equal(report.status, "new");
    assert.equal(report.issueUrl, null);
    assert.deepEqual(report.reporter, { userId: owner.id, email: owner.email });
    assert.deepEqual(report.workspace, { id: workspace.id, slug: workspace.slug, name: workspace.name });
    assert.equal(report.path, "/w/lab/parts?q=10k&token=[redacted]");
    assert.equal(report.appVersion, process.env.OSO_VERSION?.trim() || "dev");

    const expected: Partial<typeof context> = { ...context };
    delete expected.path;
    assert.deepEqual(report.context, expected);
  });

  test("a workspace the reporter is not a member of is not recorded", async () => {
    const { owner } = await createApiTestWorkspace("feedback-outsider");
    const other = await createApiTestWorkspace("feedback-other");
    const message = `Outsider ${uniqueSuffix()}`;

    await submitFeedback({
      userId: owner.id,
      clientKey: "203.0.113.2",
      submission: { kind: "idea", message, workspaceSlug: other.workspace.slug }
    });

    const row = await findReport(message);
    assert.equal(row.workspaceId, null);
    assert.equal(row.userId, owner.id);
  });

  test("an anonymous report is saved without a reporter or workspace, and returns nothing", async () => {
    const { workspace } = await createApiTestWorkspace("feedback-anonymous");
    const message = `Cannot sign in ${uniqueSuffix()}`;

    const result = await submitFeedback({
      userId: null,
      clientKey: `198.51.100.${Math.floor(Math.random() * 250)}-${uniqueSuffix()}`,
      submission: { kind: "question", message, workspaceSlug: workspace.slug, context: { path: "/sign-in" } }
    });

    assert.equal(result, undefined);

    const row = await findReport(message);
    assert.equal(row.userId, null);
    assert.equal(row.workspaceId, null);
    assert.equal(row.path, "/sign-in");
    assert.equal(row.status, "new");
  });

  test("an invalid report is refused and a flood from one reporter is rate-limited", async () => {
    const clientKey = `flood-${uniqueSuffix()}`;

    await assert.rejects(
      submitFeedback({ userId: null, clientKey, submission: { kind: "problem", message: "" } }),
      /invalid-feedback/
    );

    for (let index = 0; index < FEEDBACK_RATE_LIMIT.limit; index += 1) {
      await submitFeedback({ userId: null, clientKey, submission: { kind: "idea", message: `flood ${index}` } });
    }

    await assert.rejects(
      submitFeedback({ userId: null, clientKey, submission: { kind: "idea", message: "one too many" } }),
      /feedback-rate-limited/
    );
  });

  test("deleting the reporter keeps the report, unlinked", async () => {
    const reporter = await prisma.user.create({
      data: { email: `feedback-gone-${uniqueSuffix()}@ohmsweetohm.local`, name: "gone" }
    });
    const message = `Report from a deleted account ${uniqueSuffix()}`;

    await submitFeedback({ userId: reporter.id, clientKey: "x", submission: { kind: "problem", message } });
    await prisma.user.delete({ where: { id: reporter.id } });

    const row = await findReport(message);
    assert.equal(row.userId, null);
  });

  test("the panel's triage action is refused to a non-administrator and works for one", async () => {
    const { admin } = await createAdmin();
    const { owner } = await createApiTestWorkspace("feedback-triage-denied");
    const message = `Triage me ${uniqueSuffix()}`;

    await submitFeedback({ userId: owner.id, clientKey: "x", submission: { kind: "problem", message } });
    const row = await findReport(message);

    assert.deepEqual(await updateFeedbackAs(owner.id, row.id, { status: "triaged" }), {
      ok: false,
      error: "not-instance-admin"
    });
    assert.deepEqual(await updateFeedbackAs(null, row.id, { status: "triaged" }), {
      ok: false,
      error: "not-instance-admin"
    });
    assert.equal((await findReport(message)).status, "new");

    assert.deepEqual(await updateFeedbackAs(admin.id, row.id, { issueUrl: "https://example.com/1" }), {
      ok: false,
      error: "invalid-issue-url"
    });
    assert.deepEqual(await updateFeedbackAs(admin.id, "missing", { status: "triaged" }), {
      ok: false,
      error: "feedback-not-found"
    });

    const issueUrl = "https://github.com/michalwy/ohm-sweet-ohm/issues/325";
    assert.deepEqual(await updateFeedbackAs(admin.id, row.id, { status: "triaged", issueUrl }), {
      ok: true,
      data: { status: "triaged", issueUrl }
    });

    const triaged = await listFeedbackReports({ status: "triaged", limit: 200 });
    assert.ok(triaged.reports.some((report) => report.id === row.id));
    const fresh = await listFeedbackReports({ status: "new", limit: 200 });
    assert.ok(!fresh.reports.some((report) => report.id === row.id));
  });

  test("a non-administrator gets no feedback tools, and the implementation refuses anyway", async () => {
    const { workspace, owner } = await createApiTestWorkspace("feedback-mcp-denied");
    const { value } = await createTestToken(owner.id, workspace.id, { access: "read-write" });
    const client = await connect(value);
    const { tools } = await client.listTools();

    assert.deepEqual(
      tools.map((tool) => tool.name).filter((name) => name.includes("feedback")),
      []
    );
    await assert.rejects(client.callTool({ name: "admin_list_feedback", arguments: {} }));
    await client.close();

    const actor = await resolveTokenActor(value);
    assert.ok(actor);

    const result = await executeOperation(actor, adminListFeedbackImplementation, {});
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.error.code, "permission-denied");
  });

  test("an administrator lists by status, gets and triages a report over MCP; read-only cannot update", async () => {
    const { workspace, admin } = await createAdmin();
    const reporter = await createApiTestWorkspace("feedback-mcp-reporter");
    const message = `Over MCP ${uniqueSuffix()}`;

    await submitFeedback({
      userId: reporter.owner.id,
      clientKey: "x",
      submission: { kind: "idea", message, workspaceSlug: reporter.workspace.slug, context }
    });
    const row = await findReport(message);

    const readWrite = await createTestToken(admin.id, workspace.id, { access: "read-write" });
    const client = await connect(readWrite.value);
    const { tools } = await client.listTools();

    for (const name of ["admin_list_feedback", "admin_get_feedback", "admin_update_feedback"]) {
      assert.ok(tools.some((tool) => tool.name === name), name);
    }

    const listed = await client.callTool({ name: "admin_list_feedback", arguments: { status: "new", limit: 200 } });
    assert.ok(!listed.isError, JSON.stringify(listed));
    const page = listed.structuredContent as { reports: Array<{ id: string; status: string }>; total: number };
    assert.ok(page.reports.some((report) => report.id === row.id));
    assert.ok(page.reports.every((report) => report.status === "new"));
    assert.ok(page.total >= page.reports.length);

    const got = await client.callTool({ name: "admin_get_feedback", arguments: { feedbackId: row.id } });
    assert.ok(!got.isError, JSON.stringify(got));
    const detail = got.structuredContent as {
      message: string;
      path: string;
      reporter: { email: string };
      workspace: { slug: string };
      context: { timeZone: string; recentErrors: string[] };
    };
    assert.equal(detail.message, message);
    assert.equal(detail.path, "/w/lab/parts?q=10k&token=[redacted]");
    assert.equal(detail.reporter.email, reporter.owner.email);
    assert.equal(detail.workspace.slug, reporter.workspace.slug);
    assert.equal(detail.context.timeZone, "Europe/Warsaw");
    assert.deepEqual(detail.context.recentErrors, ["TypeError: x is undefined"]);

    const missing = await client.callTool({ name: "admin_get_feedback", arguments: { feedbackId: "missing" } });
    assert.equal(missing.isError, true);
    assert.match(JSON.stringify(missing.content), /feedback-not-found/);

    const issueUrl = "https://github.com/michalwy/ohm-sweet-ohm/issues/999";
    const updated = await client.callTool({
      name: "admin_update_feedback",
      arguments: { feedbackId: row.id, status: "triaged", issueUrl }
    });
    assert.ok(!updated.isError, JSON.stringify(updated));
    assert.equal((updated.structuredContent as { status: string }).status, "triaged");
    assert.equal((await findReport(message)).issueUrl, issueUrl);

    const bad = await client.callTool({
      name: "admin_update_feedback",
      arguments: { feedbackId: row.id, issueUrl: "not a url" }
    });
    assert.equal(bad.isError, true);
    assert.match(JSON.stringify(bad.content), /invalid-issue-url/);
    await client.close();

    const readOnly = await createTestToken(admin.id, workspace.id, { access: "read-only" });
    const readOnlyClient = await connect(readOnly.value);
    const refused = await readOnlyClient.callTool({
      name: "admin_update_feedback",
      arguments: { feedbackId: row.id, status: "new", issueUrl: "" }
    });

    assert.equal(refused.isError, true);
    assert.match(JSON.stringify(refused.content), /permission-denied/);
    assert.equal((await findReport(message)).status, "triaged");
    await readOnlyClient.close();
  });
});
