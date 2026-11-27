import "server-only";

import { implementOperation } from "@/server/api/execute";
import { requireInstanceAdminActor } from "@/server/admin/instanceAdmin";

import {
  adminGetFeedbackOperation,
  adminListFeedbackOperation,
  adminUpdateFeedbackOperation
} from "./feedbackOperations";
import {
  getFeedbackReport,
  listFeedbackReports,
  updateFeedbackReport,
  type FeedbackReportDetail,
  type FeedbackReportSummary
} from "./feedbackReports";

/** The feedback admin MCP tools' implementations (#325); each checks the instance administrator first. */

export function toFeedbackSummaryOutput(report: FeedbackReportSummary) {
  return {
    id: report.id,
    kind: report.kind,
    status: report.status,
    message: report.message,
    issueUrl: report.issueUrl,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
    reporter: report.reporter,
    workspace: report.workspace
  };
}

export function toFeedbackDetailOutput(report: FeedbackReportDetail) {
  return {
    ...toFeedbackSummaryOutput(report),
    path: report.path,
    appVersion: report.appVersion,
    context: report.context
  };
}

export const adminListFeedbackImplementation = implementOperation(
  adminListFeedbackOperation,
  async (actor, input) => {
    await requireInstanceAdminActor(actor, { write: false });

    const { reports, total } = await listFeedbackReports({ status: input.status, limit: input.limit });

    return { reports: reports.map(toFeedbackSummaryOutput), total };
  }
);

export const adminGetFeedbackImplementation = implementOperation(
  adminGetFeedbackOperation,
  async (actor, input) => {
    await requireInstanceAdminActor(actor, { write: false });

    return toFeedbackDetailOutput(await getFeedbackReport(input.feedbackId));
  }
);

export const adminUpdateFeedbackImplementation = implementOperation(
  adminUpdateFeedbackOperation,
  async (actor, input) => {
    await requireInstanceAdminActor(actor, { write: true });

    return toFeedbackDetailOutput(
      await updateFeedbackReport(input.feedbackId, { status: input.status, issueUrl: input.issueUrl })
    );
  }
);
