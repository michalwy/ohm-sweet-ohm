import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { adminCopy as copy } from "@/app/admin/admin-copy";
import { AdminHeader, adminCardClass, adminTableClass, adminTdClass, adminThClass } from "@/app/admin/admin-header";
import { getSessionInstanceAdmin } from "@/server/admin/instanceAdmin";
import { getCurrentSession } from "@/server/auth/currentContext";
import { FEEDBACK_STATUSES } from "@/server/feedback/feedbackPolicy";
import { listFeedbackReports } from "@/server/feedback/feedbackReports";

export const dynamic = "force-dynamic";

const LIMIT = 200;

function filterClass(active: boolean) {
  return active
    ? "rounded-md bg-[var(--color-accent-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text-primary)]"
    : "rounded-md px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:bg-[var(--color-bg-subtle)]";
}

function excerpt(message: string) {
  const line = message.replace(/\s+/g, " ").trim();

  return line.length > 120 ? `${line.slice(0, 119)}…` : line;
}

/** Feedback reports in the instance admin panel (#325), newest first, by status. Administrators only. */
export default async function AdminFeedbackPage({
  searchParams
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  if (!(await getCurrentSession())) {
    redirect("/sign-in");
  }

  if (!(await getSessionInstanceAdmin())) {
    notFound();
  }

  const requested = (await searchParams)?.status;
  const status = FEEDBACK_STATUSES.find((value) => value === requested);
  const { reports, total } = await listFeedbackReports({ status, limit: LIMIT });

  return (
    <main className="min-h-screen bg-[var(--color-bg-page)] text-[var(--color-text-primary)]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-6">
        <AdminHeader backHref="/admin" backLabel={copy.backToAdmin} />

        <div className="py-6">
          <h1 className="text-2xl font-semibold tracking-normal">{copy.feedbackTitle}</h1>
          <p className="mt-1 text-sm leading-6 text-[var(--color-text-secondary)]">{copy.feedbackIntro}</p>
        </div>

        <section aria-labelledby="admin-feedback-list-heading" className={adminCardClass}>
          <h2 id="admin-feedback-list-heading" className="sr-only">
            {copy.feedbackTitle}
          </h2>
          <nav aria-label={copy.columnStatus} className="mb-3 flex items-center gap-1">
            <Link aria-current={!status ? "page" : undefined} className={filterClass(!status)} href="/admin/feedback">
              {copy.feedbackFilterAll}
            </Link>
            {FEEDBACK_STATUSES.map((value) => (
              <Link
                key={value}
                aria-current={status === value ? "page" : undefined}
                className={filterClass(status === value)}
                href={`/admin/feedback?status=${value}`}
              >
                {copy.feedbackStatus[value]}
              </Link>
            ))}
            <span className="ml-auto text-xs text-[var(--color-text-muted)]">
              {copy.feedbackShown(reports.length, total)}
            </span>
          </nav>

          {reports.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">{copy.noFeedback}</p>
          ) : (
            <table className={adminTableClass}>
              <thead>
                <tr>
                  <th className={adminThClass}>{copy.columnReceived}</th>
                  <th className={adminThClass}>{copy.columnKind}</th>
                  <th className={adminThClass}>{copy.columnStatus}</th>
                  <th className={adminThClass}>{copy.columnMessage}</th>
                  <th className={adminThClass}>{copy.columnReporter}</th>
                  <th className={adminThClass}>{copy.columnIssue}</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className={`${adminTdClass} whitespace-nowrap tabular-nums`}>
                      {report.createdAt.toISOString().slice(0, 16).replace("T", " ")}
                    </td>
                    <td className={adminTdClass}>{copy.feedbackKind[report.kind]}</td>
                    <td className={adminTdClass}>{copy.feedbackStatus[report.status]}</td>
                    <td className={adminTdClass}>
                      <Link
                        className="font-medium text-[var(--color-text-primary)] underline-offset-2 hover:underline"
                        href={`/admin/feedback/${report.id}`}
                      >
                        {excerpt(report.message)}
                      </Link>
                    </td>
                    <td className={adminTdClass}>{report.reporter?.email ?? copy.anonymous}</td>
                    <td className={adminTdClass}>
                      {report.issueUrl ? (
                        <a
                          className="underline-offset-2 hover:underline"
                          href={report.issueUrl}
                          rel="noreferrer"
                          target="_blank"
                        >
                          #{report.issueUrl.split("/").pop()}
                        </a>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
