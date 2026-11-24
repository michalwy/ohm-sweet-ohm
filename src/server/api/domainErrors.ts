import "server-only";

import { Prisma } from "@/generated/prisma/client";

/**
 * Runs a domain call for an API operation and turns what the database says into the domain error
 * codes the server actions already report (#278), so REST and MCP answer them instead of an
 * `internal-error`:
 * - a unique-constraint violation (P2002) becomes `codes.unique` (e.g. `duplicate-unit-name`);
 * - a foreign-key violation (P2003) becomes `codes.foreignKey` (e.g. `unit-in-use`);
 * - a code written with underscores (`choice_attribute-not-found`) is passed on in kebab case, as
 *   the server actions do.
 */
export async function withDomainErrors<T>(
  run: () => Promise<T>,
  codes: { unique?: string; foreignKey?: string } = {}
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002" && codes.unique) {
        throw new Error(codes.unique);
      }

      if (error.code === "P2003" && codes.foreignKey) {
        throw new Error(codes.foreignKey);
      }
    }

    if (error instanceof Error && /^[a-z0-9_-]+$/.test(error.message) && error.message.includes("_")) {
      throw new Error(error.message.replaceAll("_", "-"));
    }

    throw error;
  }
}
