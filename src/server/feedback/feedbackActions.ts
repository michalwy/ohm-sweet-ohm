"use server";

import "server-only";

import { headers } from "next/headers";

import { getCurrentSession } from "@/server/auth/currentContext";

import { submitFeedback, type SubmitFeedbackError } from "./feedbackReports";

/**
 * "Send feedback" (#325), for anyone: signed in, or anonymous on the sign-in and sign-up pages. The
 * reporter is the session's user when there is one; the browser cannot name another. The answer
 * says only whether the report was saved — nothing about any report can be read back here.
 */

export type SubmitFeedbackResult = { ok: true } | { ok: false; error: SubmitFeedbackError | "unavailable" };

/** The address an anonymous reporter is rate-limited by: the first forwarded hop, when present. */
function clientKeyFrom(requestHeaders: Headers) {
  const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();

  return forwarded || requestHeaders.get("x-real-ip")?.trim() || "unknown";
}

export async function submitFeedbackAction(submission: unknown): Promise<SubmitFeedbackResult> {
  try {
    const [session, requestHeaders] = await Promise.all([getCurrentSession(), headers()]);

    await submitFeedback({
      userId: session?.user.id ?? null,
      clientKey: clientKeyFrom(requestHeaders),
      submission
    });

    return { ok: true };
  } catch (error) {
    if (error instanceof Error && (error.message === "invalid-feedback" || error.message === "feedback-rate-limited")) {
      return { ok: false, error: error.message };
    }

    console.error("Feedback could not be saved", error);
    return { ok: false, error: "unavailable" };
  }
}
