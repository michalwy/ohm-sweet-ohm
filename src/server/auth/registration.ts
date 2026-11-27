import "server-only";

import { prisma } from "@/server/db/prisma";

import { canCreateAccountNow, isRegistrationOpenByDefault } from "./registrationPolicy";

/**
 * Whether registration is open. The one place that answers this: today the configuration default
 * (`OSO_AUTH_ALLOW_SIGN_UP`); the admin panel (#324) overrides it at runtime here.
 */
export async function isRegistrationOpen(): Promise<boolean> {
  return isRegistrationOpenByDefault(process.env);
}

/** Whether a new account may be created right now (open registration, or no accounts yet). */
export async function canCreateAccount(): Promise<boolean> {
  const registrationOpen = await isRegistrationOpen();

  if (registrationOpen) {
    return true;
  }

  return canCreateAccountNow({ registrationOpen, userCount: await prisma.user.count() });
}
