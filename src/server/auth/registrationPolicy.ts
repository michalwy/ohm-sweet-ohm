/**
 * Pure rules for new-account registration (#323). No Prisma or server infrastructure here, so the
 * rules are unit-testable; `registration.ts` supplies the live inputs.
 */

/** The configuration default: registration is closed unless `OSO_AUTH_ALLOW_SIGN_UP=1`. */
export function isRegistrationOpenByDefault(env: Record<string, string | undefined>): boolean {
  return env.OSO_AUTH_ALLOW_SIGN_UP === "1";
}

/**
 * Whether a new account may be created. An instance with no accounts always lets the first one be
 * created, whatever the setting; after that, only open registration does.
 */
export function canCreateAccountNow(input: { registrationOpen: boolean; userCount: number }): boolean {
  return input.registrationOpen || input.userCount === 0;
}
