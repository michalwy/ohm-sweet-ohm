import { redirect } from "next/navigation";

import { signInWithPassword } from "@/server/auth/actions";
import { getCurrentSession } from "@/server/auth/currentContext";

export const dynamic = "force-dynamic";

const copy = {
  appShortName: "OSO",
  appName: "OhmSweetOhm",
  appSubtitle: "Home electronics workshop",
  title: "Sign in",
  email: "Email",
  password: "Password",
  submit: "Sign in",
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
    redirect("/");
  }

  const resolvedSearchParams = await searchParams;
  const error = resolvedSearchParams?.error;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 px-4 py-8 text-slate-950">
      <section
        aria-labelledby="sign-in-heading"
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
          id="sign-in-heading"
          className="text-2xl font-semibold tracking-normal text-slate-950"
        >
          {copy.title}
        </h1>

        {error ? (
          <p className="mt-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error === "missing-fields"
              ? copy.missingFields
              : copy.invalidCredentials}
          </p>
        ) : null}

        <form action={signInWithPassword} className="mt-6 grid gap-4">
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
              autoComplete="current-password"
              className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
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
      </section>
    </main>
  );
}
