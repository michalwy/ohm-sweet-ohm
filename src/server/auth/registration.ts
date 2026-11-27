import "server-only";

import { prisma } from "@/server/db/prisma";

import { canCreateAccountNow, isRegistrationOpenByDefault } from "./registrationPolicy";

const INSTANCE_SETTINGS_ID = "instance";

export type RegistrationState = {
  /** Whether new accounts may register now. */
  open: boolean;
  /** "runtime" when the admin panel set it (#324), "config" when it is `OSO_AUTH_ALLOW_SIGN_UP`. */
  source: "runtime" | "config";
  /** The configuration default (#323). */
  configDefault: boolean;
  updatedAt: Date | null;
  updatedByUserId: string | null;
};

/**
 * Registration as it stands: the admin panel's runtime setting (#324) when one was saved, otherwise
 * the configuration default `OSO_AUTH_ALLOW_SIGN_UP` (#323).
 */
export async function getRegistrationState(): Promise<RegistrationState> {
  const configDefault = isRegistrationOpenByDefault(process.env);
  const settings = await prisma.instanceSettings.findUnique({ where: { id: INSTANCE_SETTINGS_ID } });

  if (settings?.registrationOpen === null || settings?.registrationOpen === undefined) {
    return { open: configDefault, source: "config", configDefault, updatedAt: null, updatedByUserId: null };
  }

  return {
    open: settings.registrationOpen,
    source: "runtime",
    configDefault,
    updatedAt: settings.registrationUpdatedAt,
    updatedByUserId: settings.registrationUpdatedByUserId
  };
}

/** Whether registration is open. The one place that answers this (#323, #324). */
export async function isRegistrationOpen(): Promise<boolean> {
  return (await getRegistrationState()).open;
}

/**
 * Opens or closes registration at runtime (#324), overriding the configuration default until it is
 * changed again; `null` returns to the configuration default. The caller has checked that the user
 * is an instance administrator.
 */
export async function setRegistrationOpen(open: boolean | null, userId: string): Promise<RegistrationState> {
  const data = {
    registrationOpen: open,
    registrationUpdatedAt: open === null ? null : new Date(),
    registrationUpdatedByUserId: open === null ? null : userId
  };

  await prisma.instanceSettings.upsert({
    where: { id: INSTANCE_SETTINGS_ID },
    create: { id: INSTANCE_SETTINGS_ID, ...data },
    update: data
  });

  return getRegistrationState();
}

/** Whether a new account may be created right now (open registration, or no accounts yet). */
export async function canCreateAccount(): Promise<boolean> {
  const registrationOpen = await isRegistrationOpen();

  if (registrationOpen) {
    return true;
  }

  return canCreateAccountNow({ registrationOpen, userCount: await prisma.user.count() });
}
