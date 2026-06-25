import { redirect } from "next/navigation";
import Link from "next/link";

import { signInWithPassword } from "@/server/auth/actions";
import { getCurrentSession } from "@/server/auth/currentContext";
import { getLastWorkspaceRedirectPath } from "@/server/workspaces/lastWorkspace";

export const dynamic = "force-dynamic";

const copy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  appSubtitle: "Home electronics workshop",
  title: "Sign in",
  email: "Email",
  password: "Password",
  submit: "Sign in",
  signUpPrompt: "Need an account?",
  signUp: "Create account",
  emailPlaceholder: "owner@ohmsweetohm.local",
  missingFields: "Enter both email and password.",
  invalidCredentials: "Email or password is incorrect."
};

type SignInPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await getCurrentSession();

  if (session) {
    redirect(await getLastWorkspaceRedirectPath(session.user.id));
  }

  const resolvedSearchParams = await searchParams;
  const error = resolvedSearchParams?.error;

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--color-bg-page)] px-4 py-8 text-[var(--color-text-primary)]">
      <section
        aria-labelledby="sign-in-heading"
        className="w-full max-w-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] p-6 shadow-sm"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-[var(--color-accent)] text-sm font-semibold text-white">
            {copy.appShortName}
          </div>
          <div>
            <p className="text-sm font-semibold leading-5 text-[var(--color-text-primary)]">
              {copy.appName}
            </p>
            <p className="text-xs leading-4 text-[var(--color-text-muted)]">
              {copy.appSubtitle}
            </p>
          </div>
        </div>

        <h1
          id="sign-in-heading"
          className="text-2xl font-semibold tracking-normal text-[var(--color-text-primary)]"
        >
          {copy.title}
        </h1>

        {error ? (
          <p className="mt-4 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-soft)] px-3 py-2 text-sm text-[var(--color-error)]">
            {error === "missing-fields"
              ? copy.missingFields
              : copy.invalidCredentials}
          </p>
        ) : null}

        <form action={signInWithPassword} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
            {copy.email}
            <input
              autoComplete="email"
              className="min-h-11 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-2 text-base text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-placeholder)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
              name="email"
              placeholder={copy.emailPlaceholder}
              required
              type="email"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
            {copy.password}
            <input
              autoComplete="current-password"
              className="min-h-11 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-2 text-base text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-placeholder)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
              name="password"
              required
              type="password"
            />
          </label>

          <button
            className="min-h-10 rounded-md border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-4 py-2 text-sm font-semibold text-white transition hover:border-[var(--color-action-primary-hover)] hover:bg-[var(--color-action-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-focus)] focus:ring-offset-2"
            type="submit"
          >
            {copy.submit}
          </button>
        </form>

        <p className="mt-5 text-sm text-[var(--color-text-secondary)]">
          {copy.signUpPrompt}{" "}
          <Link className="font-semibold text-[var(--color-accent)] underline" href="/sign-up">
            {copy.signUp}
          </Link>
        </p>
      </section>
    </main>
  );
}
