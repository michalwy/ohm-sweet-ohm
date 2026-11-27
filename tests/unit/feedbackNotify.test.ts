import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createFeedbackNotifier,
  FEEDBACK_NOTIFY_DEBOUNCE_MS,
  type FeedbackNotifierOptions
} from "../../src/server/feedback/feedbackNotify";

/** The fire-and-forget notification of a new feedback report (#326). */

const URL_ = "https://api.example.test/v1/triggers/trig_123/fire";
const TOKEN = "test-token-not-a-secret";
const env = { FEEDBACK_NOTIFY_URL: URL_, FEEDBACK_NOTIFY_TOKEN: TOKEN };

type Call = { url: string; init: RequestInit };

function harness(overrides: Partial<FeedbackNotifierOptions> & { respond?: () => Promise<Response> } = {}) {
  const calls: Call[] = [];
  const logs: string[] = [];
  let clock = 1_000_000;
  const notify = createFeedbackNotifier({
    env,
    now: () => clock,
    log: (message) => logs.push(message),
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return overrides.respond ? overrides.respond() : new Response(null, { status: 200 });
    }) as unknown as typeof fetch,
    ...overrides
  });

  return {
    notify,
    calls,
    logs,
    advance: (ms: number) => {
      clock += ms;
    }
  };
}

describe("feedback notification (#326)", () => {
  test("fires once, a POST with the four headers and a body of exactly {}", async () => {
    const { notify, calls, logs } = harness();

    await notify();

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, URL_);
    assert.equal(calls[0].init.method, "POST");
    assert.deepEqual(calls[0].init.headers, {
      authorization: `Bearer ${TOKEN}`,
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "experimental-cc-routine-2026-04-01",
      "content-type": "application/json"
    });
    assert.equal(calls[0].init.body, "{}");
    assert.ok(calls[0].init.signal instanceof AbortSignal, "the fire has a timeout");
    assert.deepEqual(logs, ["[feedbackNotify] routine fire responded 200"]);
  });

  test("fires at most once per 30 s", async () => {
    const { notify, calls, advance } = harness();

    await notify();
    advance(FEEDBACK_NOTIFY_DEBOUNCE_MS - 1);
    await notify();
    assert.equal(calls.length, 1, "a second report within 30 s does not fire");

    advance(1);
    await notify();
    assert.equal(calls.length, 2, "after 30 s it fires again");
  });

  test("a failed fire still counts for the debounce", async () => {
    const { notify, calls, advance } = harness({ respond: () => Promise.reject(new TypeError("fetch failed")) });

    await notify();
    advance(1_000);
    await notify();
    assert.equal(calls.length, 1);
  });

  for (const missing of ["FEEDBACK_NOTIFY_URL", "FEEDBACK_NOTIFY_TOKEN"] as const) {
    test(`without ${missing} it does nothing and logs nothing`, async () => {
      const { notify, calls, logs } = harness({ env: { ...env, [missing]: undefined } });

      await notify();
      assert.equal(calls.length, 0);
      assert.deepEqual(logs, []);
    });

    test(`a blank ${missing} counts as missing`, async () => {
      const { notify, calls, logs } = harness({ env: { ...env, [missing]: "  " } });

      await notify();
      assert.equal(calls.length, 0);
      assert.deepEqual(logs, []);
    });
  }

  test("a network error, a timeout or a non-2xx never throws and logs no token, URL or body", async () => {
    const failures: Array<() => Promise<Response>> = [
      () => Promise.reject(new TypeError(`fetch failed for ${URL_}`)),
      () => Promise.reject(new DOMException("The operation timed out.", "TimeoutError")),
      () => Promise.resolve(new Response("nope", { status: 403 }))
    ];
    const expected = [
      "[feedbackNotify] routine fire failed (TypeError)",
      "[feedbackNotify] routine fire failed (TimeoutError)",
      "[feedbackNotify] routine fire responded 403"
    ];

    for (const [index, respond] of failures.entries()) {
      const { notify, logs } = harness({ respond });

      await assert.doesNotReject(notify());
      assert.deepEqual(logs, [expected[index]]);
      assert.ok(!logs.join("\n").includes(TOKEN) && !logs.join("\n").includes("trig_123"));
    }
  });

  test("a hanging endpoint is aborted after the timeout", async () => {
    const notify = createFeedbackNotifier({
      env,
      timeoutMs: 20,
      log: () => {},
      fetch: ((_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        })) as unknown as typeof fetch
    });

    // AbortSignal.timeout's timer does not keep the process alive; this one does, until the abort.
    const keepAlive = setTimeout(() => {}, 5_000);
    const started = Date.now();
    await notify();
    clearTimeout(keepAlive);
    assert.ok(Date.now() - started < 2_000);
  });

  test("resetDebounce lets the next report fire", async () => {
    const { notify, calls } = harness();

    await notify();
    notify.resetDebounce();
    await notify();
    assert.equal(calls.length, 2);
  });
});
