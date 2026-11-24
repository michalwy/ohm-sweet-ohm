/**
 * The HTTP status the REST API answers a domain error code with (#274). Pure, so unit tests can
 * load it. MCP returns the same codes as tool errors and has no statuses.
 *
 * - `…-not-found` → 404. Every lookup is scoped to the actor's workspace, so a record of another
 *   workspace is "not found", never "forbidden": the API does not reveal that it exists.
 * - `permission-denied` and the server actions' `workspace-permission-denied` /
 *   `workspace-requires-admin` → 403.
 * - `invalid-…`, `missing-…`, `…-required` → 400: the input was well-formed but not acceptable.
 * - `…-request-failed` → 502: a supplier (DigiKey, TME) did not answer the request made on the
 *   caller's behalf (#285).
 * - every other domain code → 409: the request is valid, but the current state forbids it
 *   (e.g. `order-already-received`).
 */
export function errorStatusForCode(code: string): number {
  if (code.endsWith("-not-found")) {
    return 404;
  }

  if (
    code === "permission-denied" ||
    code === "workspace-permission-denied" ||
    code === "workspace-requires-admin"
  ) {
    return 403;
  }

  if (code.startsWith("invalid-") || code.startsWith("missing-") || code.endsWith("-required")) {
    return 400;
  }

  if (code.endsWith("-request-failed")) {
    return 502;
  }

  return 409;
}
