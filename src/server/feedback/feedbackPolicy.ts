import { z } from "zod";

/**
 * Pure rules of in-app feedback (#325): what a report may carry, how its page is redacted, what an
 * issue URL looks like, and how often one reporter may send. No Prisma or server infrastructure
 * here, so the rules are unit-testable; `feedbackReports.ts` applies them.
 */

export const FEEDBACK_KINDS = ["problem", "idea", "question"] as const;
export const FEEDBACK_STATUSES = ["new", "triaged"] as const;

export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_MESSAGE_MAX = 4000;
export const FEEDBACK_ISSUE_URL_MAX = 300;
export const FEEDBACK_RECENT_ERRORS_MAX = 5;

/**
 * The diagnostic context the browser attaches to a report. Every field is optional and bounded: the
 * browser is not trusted to send any of it, and an over-long value is cut rather than refused, so
 * a report is never lost to its own context.
 */
const boundedString = (max: number) =>
  z
    .string()
    .transform((value) => value.slice(0, max))
    .optional()
    .catch(undefined);

const dimension = z.number().int().min(0).max(100_000);

export const feedbackContextSchema = z
  .object({
    path: boundedString(2000),
    userAgent: boundedString(500),
    language: boundedString(50),
    timeZone: boundedString(100),
    theme: boundedString(20),
    clientTime: boundedString(40),
    viewport: z.object({ width: dimension, height: dimension }).optional().catch(undefined),
    recentErrors: z
      .array(z.string().transform((value) => value.slice(0, 500)))
      .transform((errors) => errors.slice(-FEEDBACK_RECENT_ERRORS_MAX))
      .optional()
      .catch(undefined)
  })
  .catch({});

export type FeedbackContext = z.output<typeof feedbackContextSchema>;

/** What the browser sends with "Send feedback". */
export const feedbackSubmissionSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  message: z.string().trim().min(1).max(FEEDBACK_MESSAGE_MAX),
  /** The workspace the reporter is in; kept only when the signed-in reporter is a member. */
  workspaceSlug: z.string().max(200).optional(),
  context: feedbackContextSchema.optional().default({})
});

export type FeedbackSubmission = z.input<typeof feedbackSubmissionSchema>;

/** Query parameters whose value is replaced by `[redacted]` before a page is stored. */
const SENSITIVE_PARAM = /token|code|secret|password|passwd|state|key|session|auth|signature|verifier|credential/i;

/**
 * The page a report was sent from, as stored: path and query string, with the value of every
 * parameter that may carry a credential replaced by `[redacted]`, and no fragment. Null when there
 * is no usable path.
 */
export function redactFeedbackPath(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }

  let url: URL;

  try {
    url = new URL(raw, "http://oso.invalid");
  } catch {
    return null;
  }

  const params = new URLSearchParams();

  for (const [key, value] of url.searchParams) {
    params.append(key, SENSITIVE_PARAM.test(key) ? "[redacted]" : value);
  }

  const query = params.toString().replaceAll("%5Bredacted%5D", "[redacted]");

  return `${url.pathname}${query ? `?${query}` : ""}`.slice(0, 2000);
}

const GITHUB_ISSUE_URL = /^https:\/\/github\.com\/[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}\/issues\/[1-9]\d{0,9}$/;

/** Whether `value` is a GitHub issue URL: https://github.com/<owner>/<repo>/issues/<n>. */
export function isGitHubIssueUrl(value: string): boolean {
  return value.length <= FEEDBACK_ISSUE_URL_MAX && GITHUB_ISSUE_URL.test(value);
}

/**
 * A change to a report. An omitted field keeps its value; an empty `issueUrl` clears it. Throws
 * `invalid-issue-url` for anything else that is not a GitHub issue URL.
 */
export function normalizeFeedbackUpdate(input: { status?: FeedbackStatus; issueUrl?: string }): {
  status?: FeedbackStatus;
  issueUrl?: string | null;
} {
  const update: { status?: FeedbackStatus; issueUrl?: string | null } = {};

  if (input.status !== undefined) {
    update.status = input.status;
  }

  if (input.issueUrl !== undefined) {
    const issueUrl = input.issueUrl.trim();

    if (issueUrl === "") {
      update.issueUrl = null;
    } else if (isGitHubIssueUrl(issueUrl)) {
      update.issueUrl = issueUrl;
    } else {
      throw new Error("invalid-issue-url");
    }
  }

  return update;
}

/** How many reports one reporter (an account, or an address when anonymous) may send per window. */
export const FEEDBACK_RATE_LIMIT = { limit: 5, windowMs: 10 * 60 * 1000 } as const;

/**
 * A fixed-window counter per key, in memory. It returns whether one more event is allowed for the
 * key now, and counts it when it is. Old windows are dropped as keys are seen, and the whole map
 * when it grows past `maxKeys`, so it cannot grow without bound.
 */
export function createFixedWindowLimiter({
  limit,
  windowMs,
  maxKeys = 10_000
}: {
  limit: number;
  windowMs: number;
  maxKeys?: number;
}) {
  const windows = new Map<string, { start: number; count: number }>();

  return function allow(key: string, now: number = Date.now()): boolean {
    const current = windows.get(key);

    if (!current || now - current.start >= windowMs) {
      if (windows.size >= maxKeys) {
        windows.clear();
      }

      windows.set(key, { start: now, count: 1 });
      return true;
    }

    if (current.count >= limit) {
      return false;
    }

    current.count += 1;
    return true;
  };
}
