import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { oauthConsentCopy as copy } from "@/app/oauth-consent-copy";
import { getCurrentSession, getCurrentUserWorkspaces } from "@/server/auth/currentContext";
import {
  AUTHORIZATION_PARAM_NAMES,
  readAuthorizationParams,
  validateAuthorizationRequest
} from "@/server/oauth/oauthServer";

export const dynamic = "force-dynamic";

/**
 * The OAuth authorization endpoint and consent screen of the MCP connector (#322). A request whose
 * app or return address cannot be trusted is shown as an error; any other fault goes back to the
 * app. A signed-out user signs in first and comes back here. The answer is posted to
 * `/api/oauth/authorize`.
 */

type AuthorizePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OAuthAuthorizePage({ searchParams }: AuthorizePageProps) {
  const raw = await searchParams;
  const single = (name: string) => {
    const value = raw[name];
    return typeof value === "string" ? value : null;
  };
  const params = readAuthorizationParams(single);
  const notice = single("notice");
  const validated = await validateAuthorizationRequest(params);

  if (!validated.ok) {
    if ("redirect" in validated) {
      redirect(validated.redirect);
    }

    return (
      <ConsentCard>
        <h1 className="text-xl font-semibold">{copy.errorTitle}</h1>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          {copy.errors[validated.show] ?? copy.errors.generic}
        </p>
      </ConsentCard>
    );
  }

  const session = await getCurrentSession();

  if (!session) {
    const query = new URLSearchParams();

    for (const name of AUTHORIZATION_PARAM_NAMES) {
      const value = params[name];
      if (value !== undefined) query.set(name, value);
    }

    redirect(`/sign-in?next=${encodeURIComponent(`/oauth/authorize?${query.toString()}`)}`);
  }

  const { request } = validated;
  const workspaces = (await getCurrentUserWorkspaces()) ?? [];
  const host = new URL(request.redirectUri).host;

  return (
    <ConsentCard>
      <h1 className="text-xl font-semibold">{copy.title}</h1>
      <p className="mt-3 text-sm text-[var(--color-text-primary)]">
        {copy.intro.split("{app}")[0]}
        <strong>{request.client.name}</strong>
        {copy.intro.split("{app}")[1]}
      </p>
      <p className="mt-2 text-xs text-[var(--color-text-muted)]">
        {copy.redirectNote.replace("{host}", host)}
      </p>
      <p className="mt-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
        {copy.warning}
      </p>

      {notice ? (
        <p className="mt-4 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-soft)] px-3 py-2 text-sm text-[var(--color-error)]">
          {copy.errors[notice] ?? copy.errors.generic}
        </p>
      ) : null}

      {workspaces.length === 0 ? (
        <div className="mt-5 grid gap-3">
          <p className="text-sm text-[var(--color-text-secondary)]">{copy.noWorkspaces}</p>
          <Link className="text-sm font-semibold text-[var(--color-accent)] underline" href="/workspaces">
            {copy.goToWorkspaces}
          </Link>
        </div>
      ) : (
        <form action="/api/oauth/authorize" method="post" className="mt-5 grid gap-4">
          {AUTHORIZATION_PARAM_NAMES.map((name) =>
            params[name] !== undefined ? (
              <input key={name} name={name} type="hidden" value={params[name]} />
            ) : null
          )}

          <label className="grid gap-1 text-sm font-medium text-[var(--color-text-secondary)]">
            {copy.workspaceLabel}
            <select
              className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-focus)]"
              name="workspaceId"
              defaultValue={workspaces[0]?.workspace.id}
            >
              {workspaces.map(({ workspace }) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
            <span className="text-xs font-normal text-[var(--color-text-muted)]">{copy.workspaceHelp}</span>
          </label>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium text-[var(--color-text-secondary)]">
              {copy.accessLabel}
            </legend>
            <AccessOption value="read-only" label={copy.accessReadOnly} help={copy.accessReadOnlyHelp} defaultChecked />
            <AccessOption value="read-write" label={copy.accessReadWrite} help={copy.accessReadWriteHelp} />
          </fieldset>

          <div className="flex justify-end gap-2">
            <button
              className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-4 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
              name="decision"
              type="submit"
              value="deny"
            >
              {copy.deny}
            </button>
            <button
              className="min-h-10 rounded-md border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-action-primary-hover)]"
              name="decision"
              type="submit"
              value="approve"
            >
              {copy.approve}
            </button>
          </div>

          <p className="text-xs text-[var(--color-text-muted)]">{copy.settingsNote}</p>
        </form>
      )}
    </ConsentCard>
  );
}

function AccessOption({
  value,
  label,
  help,
  defaultChecked = false
}: {
  value: string;
  label: string;
  help: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
      <input className="mt-1" defaultChecked={defaultChecked} name="access" type="radio" value={value} />
      <span>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-[var(--color-text-muted)]">{help}</span>
      </span>
    </label>
  );
}

function ConsentCard({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-bg-page)] px-4 py-8 text-[var(--color-text-primary)]">
      <section className="w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-[var(--color-accent)] text-sm font-semibold text-white">
            {copy.appShortName}
          </div>
          <p className="text-sm font-semibold">{copy.appName}</p>
        </div>
        {children}
      </section>
    </main>
  );
}
