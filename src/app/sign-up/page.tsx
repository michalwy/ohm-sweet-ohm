import Link from "next/link";
import { redirect } from "next/navigation";

import { signUpWithPassword } from "@/server/auth/actions";
import { getCurrentSession } from "@/server/auth/currentContext";
import { getLastWorkspaceRedirectPath } from "@/server/workspaces/lastWorkspace";

export const dynamic = "force-dynamic";

const copy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  appSubtitle: "Home electronics workshop",
  title: "Create account",
  name: "Name",
  email: "Email",
  password: "Password",
  submit: "Create account",
  signInPrompt: "Already have an account?",
  signIn: "Sign in",
  namePlaceholder: "Ada Lovelace",
  emailPlaceholder: "owner@ohmsweetohm.local",
  missingFields: "Enter name, email, and password.",
  passwordTooShort: "Use at least 8 characters for the password.",
  emailTaken: "An account with this email already exists."
};

type SignUpPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const session = await getCurrentSession();

  if (session) {
    redirect(await getLastWorkspaceRedirectPath(session.user.id));
  }

  const resolvedSearchParams = await searchParams;
  const error = resolvedSearchParams?.error;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-8 text-slate-950">
      <section
        aria-labelledby="sign-up-heading"
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-slate-950 text-sm font-semibold text-white">
            {copy.appShortName}
          </div>
          <div>
            <p className="text-sm font-semibold leading-5 text-slate-950">
              {copy.appName}
            </p>
            <p className="text-xs leading-4 text-slate-500">
              {copy.appSubtitle}
            </p>
          </div>
        </div>

        <h1
          id="sign-up-heading"
          className="text-2xl font-semibold tracking-normal text-slate-950"
        >
          {copy.title}
        </h1>

        {error ? (
          <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {getErrorMessage(error)}
          </p>
        ) : null}

        <form action={signUpWithPassword} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {copy.name}
            <input
              autoComplete="name"
              className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              name="name"
              placeholder={copy.namePlaceholder}
              required
              type="text"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {copy.email}
            <input
              autoComplete="email"
              className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              name="email"
              placeholder={copy.emailPlaceholder}
              required
              type="email"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium text-slate-700">
            {copy.password}
            <input
              autoComplete="new-password"
              className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              minLength={8}
              name="password"
              required
              type="password"
            />
          </label>

          <button
            className="min-h-11 rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            type="submit"
          >
            {copy.submit}
          </button>
        </form>

        <p className="mt-5 text-sm text-slate-600">
          {copy.signInPrompt}{" "}
          <Link className="font-semibold text-slate-950 underline" href="/sign-in">
            {copy.signIn}
          </Link>
        </p>
      </section>
    </main>
  );
}

function getErrorMessage(error: string) {
  if (error === "missing-fields") {
    return copy.missingFields;
  }

  if (error === "password-too-short") {
    return copy.passwordTooShort;
  }

  return copy.emailTaken;
}
