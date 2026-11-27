/**
 * Pure rules of the instance administrator (#324). No Prisma or server infrastructure here, so the
 * rules are unit-testable; `instanceAdmin.ts` supplies the live inputs.
 */

export type InstanceAdminCandidate = { id: string; isInstanceAdmin: boolean };

/**
 * Whether `userId` is an instance administrator. A user whose `isInstanceAdmin` flag is set is
 * one. While no account carries the flag, the **oldest account** — the first one created on the
 * instance — is the administrator, so a fresh instance (and an existing one, without a data
 * migration) has exactly one administrator without any setup.
 *
 * `flagged` is every flagged account; `oldest` is the oldest account, or null on an empty instance.
 */
export function isInstanceAdministrator(input: {
  userId: string;
  flagged: readonly InstanceAdminCandidate[];
  oldest: InstanceAdminCandidate | null;
}): boolean {
  if (input.flagged.length > 0) {
    return input.flagged.some((user) => user.id === input.userId);
  }

  return input.oldest?.id === input.userId;
}

/**
 * Whether a user's workspace is deleted by "delete the user's data": a workspace the user owns
 * (holds the owner role in) and no other member owns. A co-owned workspace is left to its other
 * owners.
 */
export function isSolelyOwnedWorkspace(input: { userIsOwner: boolean; otherOwnerCount: number }) {
  return input.userIsOwner && input.otherOwnerCount === 0;
}
