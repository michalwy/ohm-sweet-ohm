import { z } from "zod";

import { defineOperation } from "@/server/api/operations";

import { FEEDBACK_ISSUE_URL_MAX, FEEDBACK_KINDS, FEEDBACK_STATUSES } from "./feedbackPolicy";

/**
 * The instance administrator's feedback operations (#325), offered as `admin_…` MCP tools beside
 * the admin panel's (#324). Pure, so unit tests can load it; the implementations are in
 * `feedbackApi.ts`. As with the other admin operations, `permission` is `null` and every
 * implementation checks the instance administrator itself.
 */

const ADMIN_ONLY = "Instance administrators only.";

const feedbackIdInput = z.string().min(1).max(64).describe("The report's id, from admin_list_feedback.");

const reporterSchema = z
  .object({
    userId: z.string().describe("The reporter's account id."),
    email: z.string().describe("The reporter's email address.")
  })
  .nullable()
  .describe("The signed-in reporter; null when the report was sent anonymously or the account was deleted.");

const workspaceSchema = z
  .object({
    id: z.string().describe("The workspace's id."),
    slug: z.string().describe("The workspace's slug, as in its URL /w/<slug>."),
    name: z.string().describe("The workspace's name.")
  })
  .nullable()
  .describe("The workspace the reporter was in; null when none (or it was deleted).");

export const feedbackSummarySchema = z.object({
  id: z.string().describe("The report's id."),
  kind: z.enum(FEEDBACK_KINDS).describe("What the reporter said it is: problem, idea or question."),
  status: z.enum(FEEDBACK_STATUSES).describe("new until triaged; triaged once handled."),
  message: z.string().describe("The reporter's own words."),
  issueUrl: z.string().nullable().describe("The GitHub issue the report became; null when none."),
  createdAt: z.iso.datetime().describe("When the report was sent (ISO 8601, UTC)."),
  updatedAt: z.iso.datetime().describe("When the report last changed (ISO 8601, UTC)."),
  reporter: reporterSchema,
  workspace: workspaceSchema
});

export const feedbackDetailSchema = feedbackSummarySchema.extend({
  path: z
    .string()
    .nullable()
    .describe("The page the report was sent from, path and query, credentials redacted; null when unknown."),
  appVersion: z.string().describe("The OSO version that received the report (\"dev\" outside a release)."),
  context: z
    .object({
      userAgent: z.string().optional().describe("The browser's user agent."),
      language: z.string().optional().describe("The browser's language."),
      timeZone: z.string().optional().describe("The browser's time zone."),
      theme: z.string().optional().describe("The app theme in use: light or dark."),
      clientTime: z.string().optional().describe("The reporter's clock when sending (ISO 8601)."),
      viewport: z
        .object({ width: z.number().int(), height: z.number().int() })
        .optional()
        .describe("The browser window's size in CSS pixels."),
      recentErrors: z
        .array(z.string())
        .optional()
        .describe("The page's last script errors before sending, oldest first.")
    })
    .describe("Diagnostic context the browser attached.")
});

export const adminListFeedbackOperation = defineOperation({
  name: "admin_list_feedback",
  description: `${ADMIN_ONLY} Feedback reports sent with "Send feedback", newest first. \`status\` narrows them (new, triaged); without it, every status. Open one with admin_get_feedback for its context.`,
  permission: null,
  input: z.object({
    status: z.enum(FEEDBACK_STATUSES).optional().describe("Only reports with this status."),
    limit: z.number().int().min(1).max(200).default(50).describe("At most this many reports. Default 50.")
  }),
  output: z.object({
    reports: z.array(feedbackSummarySchema).describe("The reports, newest first."),
    total: z.number().int().describe("How many reports match, beyond the limit too.")
  })
});

export const adminGetFeedbackOperation = defineOperation({
  name: "admin_get_feedback",
  description: `${ADMIN_ONLY} One feedback report with everything sent with it: the message, the page (credentials redacted), the app version, browser, window, language, time zone, theme, the reporter's clock, the page's recent errors, the reporter and the workspace.`,
  permission: null,
  input: z.object({ feedbackId: feedbackIdInput }),
  output: feedbackDetailSchema
});

export const adminUpdateFeedbackOperation = defineOperation({
  name: "admin_update_feedback",
  description: `${ADMIN_ONLY} Set a report's status (new, triaged) and the GitHub issue URL it became (https://github.com/<owner>/<repo>/issues/<n>). An omitted field keeps its value; an empty issueUrl clears it.`,
  permission: null,
  input: z.object({
    feedbackId: feedbackIdInput,
    status: z.enum(FEEDBACK_STATUSES).optional().describe("The new status."),
    issueUrl: z
      .string()
      .max(FEEDBACK_ISSUE_URL_MAX)
      .optional()
      .describe("The GitHub issue URL; an empty string clears it.")
  }),
  output: feedbackDetailSchema
});
