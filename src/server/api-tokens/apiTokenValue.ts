import { createHash, randomBytes } from "node:crypto";

/**
 * The value of a personal API token (#273): `oso_` followed by 32 random bytes in base64url
 * (43 characters). It is shown to its user once, at creation; the database keeps only its SHA-256
 * hash. A slow password hash is not needed: the value is 256 random bits, not a guessable secret.
 *
 * No Prisma and no server infrastructure, so unit tests can load it.
 */
export const API_TOKEN_PREFIX = "oso_";

const TOKEN_BYTES = 32;
const TOKEN_BODY_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateApiTokenValue() {
  return `${API_TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
}

/** Whether a string has the shape of a token value; a malformed one is rejected without a lookup. */
export function isWellFormedApiToken(value: string) {
  return (
    value.startsWith(API_TOKEN_PREFIX) &&
    TOKEN_BODY_PATTERN.test(value.slice(API_TOKEN_PREFIX.length))
  );
}

export function hashApiTokenValue(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
