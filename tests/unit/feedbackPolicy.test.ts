import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { getOperationJsonSchemas } from "../../src/server/api/operations";
import * as feedbackOperations from "../../src/server/feedback/feedbackOperations";
import {
  createFixedWindowLimiter,
  feedbackContextSchema,
  feedbackSubmissionSchema,
  isGitHubIssueUrl,
  normalizeFeedbackUpdate,
  redactFeedbackPath
} from "../../src/server/feedback/feedbackPolicy";

describe("feedback rules (#325)", () => {
  test("a page keeps its path and query, with credentials redacted and no fragment", () => {
    assert.equal(redactFeedbackPath("/w/lab/parts?q=resistor&page=2#top"), "/w/lab/parts?q=resistor&page=2");
    assert.equal(
      redactFeedbackPath("/oauth/authorize?client_id=abc&state=xyz&code_challenge=s3cr3t&redirect_uri=x"),
      "/oauth/authorize?client_id=abc&state=[redacted]&code_challenge=[redacted]&redirect_uri=x"
    );
    assert.equal(redactFeedbackPath("/reset?token=abc&apiKey=1"), "/reset?token=[redacted]&apiKey=[redacted]");
    assert.equal(redactFeedbackPath("https://elsewhere.example/sign-in"), "/sign-in");
    assert.equal(redactFeedbackPath(""), null);
    assert.equal(redactFeedbackPath(undefined), null);
  });

  test("only GitHub issue URLs are accepted, and an empty one clears", () => {
    assert.equal(isGitHubIssueUrl("https://github.com/michalwy/ohm-sweet-ohm/issues/325"), true);
    assert.equal(isGitHubIssueUrl("https://github.com/michalwy/ohm-sweet-ohm/pull/325"), false);
    assert.equal(isGitHubIssueUrl("http://github.com/a/b/issues/1"), false);
    assert.equal(isGitHubIssueUrl("https://github.com.evil/a/b/issues/1"), false);
    assert.equal(isGitHubIssueUrl("https://github.com/a/b/issues/0"), false);

    assert.deepEqual(normalizeFeedbackUpdate({}), {});
    assert.deepEqual(normalizeFeedbackUpdate({ status: "triaged", issueUrl: " " }), {
      status: "triaged",
      issueUrl: null
    });
    assert.deepEqual(normalizeFeedbackUpdate({ issueUrl: "https://github.com/a/b/issues/7" }), {
      issueUrl: "https://github.com/a/b/issues/7"
    });
    assert.throws(() => normalizeFeedbackUpdate({ issueUrl: "https://example.com" }), /invalid-issue-url/);
  });

  test("a submission needs a kind and a message; bad context is dropped, not refused", () => {
    assert.equal(feedbackSubmissionSchema.safeParse({ kind: "problem", message: "  " }).success, false);
    assert.equal(feedbackSubmissionSchema.safeParse({ kind: "rant", message: "x" }).success, false);
    assert.equal(
      feedbackSubmissionSchema.safeParse({ kind: "idea", message: "x".repeat(4001) }).success,
      false
    );

    const parsed = feedbackSubmissionSchema.parse({
      kind: "question",
      message: " Why? ",
      context: { userAgent: 42, viewport: { width: 1280, height: 800 }, language: "x".repeat(80) }
    });

    assert.equal(parsed.message, "Why?");
    assert.equal(parsed.context.userAgent, undefined);
    assert.deepEqual(parsed.context.viewport, { width: 1280, height: 800 });
    assert.equal(parsed.context.language?.length, 50);
    assert.deepEqual(feedbackContextSchema.parse("garbage"), {});
    assert.deepEqual(
      feedbackContextSchema.parse({ recentErrors: ["1", "2", "3", "4", "5", "6", "7"] }).recentErrors,
      ["3", "4", "5", "6", "7"]
    );
  });

  test("the rate limit allows `limit` events per key per window", () => {
    const allow = createFixedWindowLimiter({ limit: 2, windowMs: 1000 });

    assert.equal(allow("a", 0), true);
    assert.equal(allow("a", 10), true);
    assert.equal(allow("a", 20), false);
    assert.equal(allow("b", 20), true);
    assert.equal(allow("a", 1000), true);
  });

  test("the feedback admin operations have object schemas", () => {
    const operations = Object.values(feedbackOperations).filter(
      (value): value is typeof feedbackOperations.adminListFeedbackOperation =>
        typeof value === "object" && value !== null && "name" in value && "permission" in value
    );

    assert.deepEqual(
      operations.map((operation) => operation.name).sort(),
      ["admin_get_feedback", "admin_list_feedback", "admin_update_feedback"]
    );

    for (const operation of operations) {
      assert.equal(operation.permission, null);
      const schemas = getOperationJsonSchemas(operation);
      assert.equal(schemas.input.type, "object");
      assert.equal(schemas.output.type, "object");
    }
  });
});
