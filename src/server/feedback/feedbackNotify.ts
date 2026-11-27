/**
 * Tells the project that a feedback report arrived (#326). After a report is saved the backend
 * fires the project's Claude routine "New in-app feedback" through its API trigger; the routine's
 * one-line reply in the project is what starts triage (`docs/agents/feedback-triage.md`).
 *
 * The fire is `POST <FEEDBACK_NOTIFY_URL>` with `authorization: Bearer <FEEDBACK_NOTIFY_TOKEN>`,
 * `anthropic-version: 2023-06-01`, `content-type: application/json` and a body of exactly `{}` —
 * the trigger refuses a body with `text` with a misleading 403 — plus the routines API's beta
 * header, which its documentation requires.
 *
 * **Fire and forget.** It never throws, is not awaited by the request that saved the report, gives
 * up after a short timeout, fires at most once per 30 s (a report within that window is covered by
 * the fire before it: the triage lists every `new` report), and logs the status code only — never
 * the token, the URL or a body. Without either setting it does nothing, silently.
 *
 * Pure (no Prisma, no `server-only`), so unit tests drive it with their own fetch and clock.
 */

export const FEEDBACK_NOTIFY_DEBOUNCE_MS = 30_000;
export const FEEDBACK_NOTIFY_TIMEOUT_MS = 5_000;
export const FEEDBACK_NOTIFY_ANTHROPIC_VERSION = "2023-06-01";
/** The routines API is a beta; its docs (code.claude.com/docs/en/routines) require this header. */
export const FEEDBACK_NOTIFY_ANTHROPIC_BETA = "experimental-cc-routine-2026-04-01";

type NotifyEnv = { FEEDBACK_NOTIFY_URL?: string; FEEDBACK_NOTIFY_TOKEN?: string };

export type FeedbackNotifierOptions = {
  env?: NotifyEnv;
  fetch?: typeof fetch;
  now?: () => number;
  log?: (message: string) => void;
  timeoutMs?: number;
  debounceMs?: number;
};

export type FeedbackNotifier = {
  (): Promise<void>;
  /** Forgets the last fire, so the next one is not debounced. For tests. */
  resetDebounce: () => void;
};

/**
 * A notifier with its own debounce window. Calling it resolves when the fire has finished (or was
 * skipped) and never rejects; callers do not await it.
 */
export function createFeedbackNotifier(options: FeedbackNotifierOptions = {}): FeedbackNotifier {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now;
  const log = options.log ?? ((message: string) => console.info(message));
  const timeoutMs = options.timeoutMs ?? FEEDBACK_NOTIFY_TIMEOUT_MS;
  const debounceMs = options.debounceMs ?? FEEDBACK_NOTIFY_DEBOUNCE_MS;
  let lastFireAt: number | null = null;

  const notify = async function notifyNewFeedback() {
    try {
      const url = env.FEEDBACK_NOTIFY_URL?.trim();
      const token = env.FEEDBACK_NOTIFY_TOKEN?.trim();

      if (!url || !token) {
        return;
      }

      const at = now();

      if (lastFireAt !== null && at - lastFireAt < debounceMs) {
        return;
      }

      lastFireAt = at;

      const doFetch = options.fetch ?? fetch;
      const response = await doFetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "anthropic-version": FEEDBACK_NOTIFY_ANTHROPIC_VERSION,
          "anthropic-beta": FEEDBACK_NOTIFY_ANTHROPIC_BETA,
          "content-type": "application/json"
        },
        body: "{}",
        signal: AbortSignal.timeout(timeoutMs)
      });

      log(`[feedbackNotify] routine fire responded ${response.status}`);
    } catch (error) {
      // The error's message can carry the URL; only its kind is logged.
      const kind = error instanceof Error ? error.name : "unknown";

      log(`[feedbackNotify] routine fire failed (${kind})`);
    }
  };

  return Object.assign(notify, {
    resetDebounce: () => {
      lastFireAt = null;
    }
  });
}

/** The app's notifier, reading the settings from the environment at each fire. */
export const notifyNewFeedback = createFeedbackNotifier();
