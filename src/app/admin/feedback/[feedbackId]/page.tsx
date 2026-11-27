import { notFound, redirect } from "next/navigation";

import { adminCopy as copy } from "@/app/admin/admin-copy";
import { AdminHeader, adminCardClass } from "@/app/admin/admin-header";
import { FeedbackTriageForm } from "@/app/admin/feedback-triage-form";
import { getSessionInstanceAdmin } from "@/server/admin/instanceAdmin";
import { getCurrentSession } from "@/server/auth/currentContext";
import { getFeedbackReport } from "@/server/feedback/feedbackReports";

export const dynamic = "force-dynamic";

function ContextRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid grid-cols-[12rem_1fr] gap-3 border-b border-[var(--color-border)] py-2 text-sm">
      <dt className="text-[var(--color-text-muted)]">{label}</dt>
      <dd className="break-all text-[var(--color-text-secondary)]">{value || copy.contextNone}</dd>
    </div>
  );
}

/** One feedback report in the instance admin panel (#325): the message, its context and triage. */
export default async function AdminFeedbackReportPage({ params }: { params: Promise<{ feedbackId: string }> }) {
  if (!(await getCurrentSession())) {
    redirect("/sign-in");
  }

  if (!(await getSessionInstanceAdmin())) {
    notFound();
  }

  const { feedbackId } = await params;
  const report = await getFeedbackReport(feedbackId).catch(() => null);

  if (!report) {
    notFound();
  }

  const { context } = report;

  return (
    <main className="min-h-screen bg-[var(--color-bg-page)] text-[var(--color-text-primary)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6">
        <AdminHeader backHref="/admin/feedback" backLabel={copy.backToFeedback} />

        <div className="py-6">
          <h1 className="text-2xl font-semibold tracking-normal">
            {copy.feedbackReportTitle(copy.feedbackKind[report.kind])}
          </h1>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">
            {report.createdAt.toISOString().slice(0, 16).replace("T", " ")} UTC ·{" "}
            {report.reporter?.email ?? copy.anonymous} · {copy.feedbackStatus[report.status]}
          </p>
        </div>

        <div className="grid grid-cols-[2fr_1fr] gap-6">
          <div className="grid gap-6">
            <section aria-labelledby="feedback-message-heading" className={adminCardClass}>
              <h2 id="feedback-message-heading" className="mb-3 text-lg font-semibold">
                {copy.feedbackMessage}
              </h2>
              <p className="text-sm leading-6 whitespace-pre-wrap text-[var(--color-text-primary)]">{report.message}</p>
            </section>

            <section aria-labelledby="feedback-context-heading" className={adminCardClass}>
              <h2 id="feedback-context-heading" className="mb-2 text-lg font-semibold">
                {copy.feedbackContext}
              </h2>
              <dl>
                <ContextRow label={copy.contextPage} value={report.path} />
                <ContextRow label={copy.contextVersion} value={report.appVersion} />
                <ContextRow
                  label={copy.contextWorkspace}
                  value={report.workspace ? `${report.workspace.name} (/w/${report.workspace.slug})` : null}
                />
                <ContextRow label={copy.contextBrowser} value={context.userAgent} />
                <ContextRow
                  label={copy.contextWindow}
                  value={context.viewport ? `${context.viewport.width} × ${context.viewport.height}` : null}
                />
                <ContextRow label={copy.contextLanguage} value={context.language} />
                <ContextRow label={copy.contextTimeZone} value={context.timeZone} />
                <ContextRow label={copy.contextTheme} value={context.theme} />
                <ContextRow label={copy.contextClientTime} value={context.clientTime} />
              </dl>
              <h3 className="mt-4 mb-1 text-sm font-semibold">{copy.contextRecentErrors}</h3>
              {context.recentErrors && context.recentErrors.length > 0 ? (
                <pre className="overflow-auto rounded-md bg-[var(--color-bg-subtle)] p-2 font-mono text-xs whitespace-pre-wrap break-all">
                  {context.recentErrors.join("\n")}
                </pre>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">{copy.contextNone}</p>
              )}
            </section>
          </div>

          <section aria-labelledby="feedback-triage-heading" className={`${adminCardClass} h-fit`}>
            <h2 id="feedback-triage-heading" className="mb-3 text-lg font-semibold">
              {copy.triageTitle}
            </h2>
            <FeedbackTriageForm feedbackId={report.id} status={report.status} issueUrl={report.issueUrl ?? ""} />
          </section>
        </div>
      </div>
    </main>
  );
}
