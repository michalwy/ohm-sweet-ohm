"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth } from "@/server/auth/auth";

const signInCopy = {
  emailTaken: "email-taken",
  invalid: "invalid-credentials",
  missingFields: "missing-fields",
  passwordTooShort: "password-too-short"
};

export async function signInWithPassword(formData: FormData) {
  const email = getRequiredFormValue(formData, "email");
  const password = getRequiredFormValue(formData, "password");

  if (!email || !password) {
    redirect(`/sign-in?error=${signInCopy.missingFields}`);
  }

  try {
    await auth.api.signInEmail({
      body: {
        email,
        password
      },
      headers: await headers()
    });
  } catch {
    redirect(`/sign-in?error=${signInCopy.invalid}`);
  }

  redirect("/workspaces");
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
