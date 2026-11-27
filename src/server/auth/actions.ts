"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth/auth";
import { safeOAuthNextPath } from "@/server/oauth/oauthValues";
import {
  clearLastWorkspaceSlug,
  getLastWorkspaceRedirectPath
} from "@/server/workspaces/lastWorkspace";

const signInCopy = {
  emailTaken: "email-taken",
  invalid: "invalid-credentials",
  missingFields: "missing-fields",
  passwordTooShort: "password-too-short"
};

export async function signInWithPassword(formData: FormData) {
  const email = getRequiredFormValue(formData, "email");
  const password = getRequiredFormValue(formData, "password");
  // An OAuth authorization request to return to (#322); any other value is dropped.
  const next = safeOAuthNextPath(getRequiredFormValue(formData, "next"));
  const nextQuery = next ? `&next=${encodeURIComponent(next)}` : "";

  if (!email || !password) {
    redirect(`/sign-in?error=${signInCopy.missingFields}${nextQuery}`);
  }

  let userId = "";

  try {
    const signInResult = await auth.api.signInEmail({
      body: {
        email,
        password
      },
      headers: await headers()
    });

    userId = signInResult.user.id;
  } catch {
    redirect(`/sign-in?error=${signInCopy.invalid}${nextQuery}`);
  }

  if (next) {
    redirect(next);
  }

  if (!userId) {
    redirect("/workspaces");
  }

  const redirectPath = await getLastWorkspaceRedirectPath(userId);

  if (redirectPath === "/workspaces") {
    await clearLastWorkspaceSlug();
  }

  redirect(redirectPath);
}

export async function signUpWithPassword(formData: FormData) {
  const name = getRequiredFormValue(formData, "name");
  const email = getRequiredFormValue(formData, "email");
  const password = getRequiredFormValue(formData, "password");

  if (!name || !email || !password) {
    redirect(`/sign-up?error=${signInCopy.missingFields}`);
  }

  if (password.length < 8) {
    redirect(`/sign-up?error=${signInCopy.passwordTooShort}`);
  }

  try {
    await auth.api.signUpEmail({
      body: {
        name,
        email,
        password
      },
      headers: await headers()
    });
  } catch {
    redirect(`/sign-up?error=${signInCopy.emailTaken}`);
  }

  redirect("/workspaces");
}

export async function signOut() {
  await auth.api.signOut({
    headers: await headers()
  });

  redirect("/sign-in");
}

function getRequiredFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}
