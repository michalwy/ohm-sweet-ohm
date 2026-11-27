import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getAppVersion } from "@/lib/version";
import { prisma } from "@/server/db/prisma";

import {
  createFixedWindowLimiter,
  FEEDBACK_RATE_LIMIT,
  feedbackContextSchema,
  feedbackSubmissionSchema,
  normalizeFeedbackUpdate,
  redactFeedbackPath,
  type FeedbackContext,
  type FeedbackKind,
  type FeedbackStatus
} from "./feedbackPolicy";

/**
 * In-app feedback (#325): saving a report from anyone, signed in or not, and reading and triaging
 * reports for instance administrators. Callers check the administrator (`adminActionCore.ts`,
 * `feedbackApi.ts`); a submitter gets nothing back but whether the report was saved.
 */

const allowReport = createFixedWindowLimiter(FEEDBACK_RATE_LIMIT);

export type SubmitFeedbackError = "invalid-feedback" | "feedback-rate-limited";

/**
 * Saves a report. `userId` is the signed-in reporter, or null when anonymous; `clientKey` names an
 * anonymous reporter for the rate limit (their address). The workspace is kept only when the
 * reporter is signed in and a member of it. Throws `invalid-feedback` or `feedback-rate-limited`.
 */
export async function submitFeedback(input: {
  userId: string | null;
  clientKey: string;
  submission: unknown;
}): Promise<void> {
  const parsed = feedbackSubmissionSchema.safeParse(input.submission);

  if (!parsed.success) {
    throw new Error("invalid-feedback");
  }

  const rateKey = input.userId ? `user:${input.userId}` : `client:${input.clientKey}`;

  if (!allowReport(rateKey)) {
    throw new Error("feedback-rate-limited");
  }

  const { kind, message, workspaceSlug, context } = parsed.data;
  const workspace =
    input.userId && workspaceSlug
      ? await prisma.workspace.findFirst({
          where: { slug: workspaceSlug, members: { some: { userId: input.userId } } },
          select: { id: true }
        })
      : null;
  const { path, ...rest } = context;

  await prisma.feedbackReport.create({
    data: {
      kind,
      message,
      userId: input.userId,
      workspaceId: workspace?.id ?? null,
      path: redactFeedbackPath(path),
      appVersion: getAppVersion(),
      context: rest as Prisma.InputJsonObject
    }
  });
}

export type FeedbackReportSummary = {
  id: string;
  kind: FeedbackKind;
  status: FeedbackStatus;
  message: string;
  issueUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  reporter: { userId: string; email: string } | null;
  workspace: { id: string; slug: string; name: string } | null;
};

export type FeedbackReportDetail = FeedbackReportSummary & {
  path: string | null;
  appVersion: string;
  context: Omit<FeedbackContext, "path">;
};

const reportInclude = {
  user: { select: { id: true, email: true } },
  workspace: { select: { id: true, slug: true, name: true } }
} as const;

type ReportRow = Prisma.FeedbackReportGetPayload<{ include: typeof reportInclude }>;

function toSummary(row: ReportRow): FeedbackReportSummary {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    message: row.message,
    issueUrl: row.issueUrl,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    reporter: row.user ? { userId: row.user.id, email: row.user.email } : null,
    workspace: row.workspace
  };
}

function toDetail(row: ReportRow): FeedbackReportDetail {
  // The page is stored in its own column, redacted; a `path` in the JSON is never shown.
  const context: Omit<FeedbackContext, "path"> = feedbackContextSchema.parse(row.context ?? {});
  delete (context as FeedbackContext).path;

  return { ...toSummary(row), path: row.path, appVersion: row.appVersion, context };
}

/** Reports, newest first, optionally of one status; `total` counts every match. */
export async function listFeedbackReports({
  status,
  limit = 50
}: {
  status?: FeedbackStatus;
  limit?: number;
} = {}): Promise<{ reports: FeedbackReportSummary[]; total: number }> {
  const where = status ? { status } : {};
  const [rows, total] = await Promise.all([
    prisma.feedbackReport.findMany({
      where,
      include: reportInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit
    }),
    prisma.feedbackReport.count({ where })
  ]);

  return { reports: rows.map(toSummary), total };
}

/** How many reports have the status `new`. */
export function countNewFeedbackReports(): Promise<number> {
  return prisma.feedbackReport.count({ where: { status: "new" } });
}

/** One report with its context; throws `feedback-not-found`. */
export async function getFeedbackReport(id: string): Promise<FeedbackReportDetail> {
  const row = await prisma.feedbackReport.findUnique({ where: { id }, include: reportInclude });

  if (!row) {
    throw new Error("feedback-not-found");
  }

  return toDetail(row);
}

/**
 * Sets a report's status and the GitHub issue it became. An omitted field keeps its value; an
 * empty `issueUrl` clears it. Throws `feedback-not-found` or `invalid-issue-url`.
 */
export async function updateFeedbackReport(
  id: string,
  input: { status?: FeedbackStatus; issueUrl?: string }
): Promise<FeedbackReportDetail> {
  const data = normalizeFeedbackUpdate(input);
  const existing = await prisma.feedbackReport.findUnique({ where: { id }, select: { id: true } });

  if (!existing) {
    throw new Error("feedback-not-found");
  }

  const row = await prisma.feedbackReport.update({ where: { id }, data, include: reportInclude });

  return toDetail(row);
}
