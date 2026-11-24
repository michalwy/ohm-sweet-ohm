import "server-only";

import type { z } from "zod";

import type { WorkspaceActor } from "@/server/access-control/actor";
import { readBearerToken } from "@/server/api/bearer";
import {
  executeOperation,
  type OperationFailure,
  type OperationImplementation
} from "@/server/api/execute";
import { getOperationJsonSchemas } from "@/server/api/operations";
import { readQueryInput } from "@/server/api/queryInput";
import { resolveWorkspaceActor } from "@/server/auth/currentActor";

/**
 * The REST adapter (#274): turns an operation implementation into a route handler under
 * `/api/v1`. Every endpoint answers JSON; a failure is `{ "error": { code, message, issues? } }`
 * with the status from `errorStatus.ts`, and 401 for a missing or invalid token.
 */

const noStore = { "cache-control": "no-store" };

export function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}) {
  return Response.json(body, { status, headers: { ...noStore, ...headers } });
}

export function errorResponse({ status, error }: OperationFailure) {
  const headers: HeadersInit =
    status === 401 ? { "www-authenticate": 'Bearer realm="OhmSweetOhm"' } : {};

  return jsonResponse({ error }, status, headers);
}

export const unauthorizedFailure: OperationFailure = {
  status: 401,
  error: {
    code: "unauthorized",
    message:
      "Send a valid personal API token as \"Authorization: Bearer <token>\". The token may be missing, malformed, unknown, revoked or expired, or its workspace may be archived."
  }
};

/**
 * The actor for an API request: the bearer token's user in the token's workspace, through the one
 * actor entry point (`resolveWorkspaceActor`). Cookies are never read.
 */
export async function authenticateApiRequest(request: Request): Promise<WorkspaceActor | null> {
  const token = readBearerToken(request.headers);

  if (!token) {
    return null;
  }

  return resolveWorkspaceActor({ kind: "token", token });
}

/**
 * What Next.js passes a route handler as its second argument: the dynamic segments of its path,
 * e.g. `{ id }` for `src/app/api/v1/organizations/[id]/route.ts`.
 */
export type RestRouteContext = { params: Promise<Record<string, string | string[] | undefined>> };

/**
 * A route handler for one operation. `GET` reads the input from the query string, every other
 * method from a JSON body (an empty body is `{}`). Path parameters (`/organizations/{id}`, served by
 * a `[id]` route segment) are input fields too, and win over a field of the same name in the query
 * or body (#279).
 */
export function restOperation<TInput extends z.ZodType, TOutput extends z.ZodType>(
  implementation: OperationImplementation<TInput, TOutput>
) {
  const inputJsonSchema = getOperationJsonSchemas(implementation.operation).input;

  return async function handle(request: Request, context?: RestRouteContext): Promise<Response> {
    const actor = await authenticateApiRequest(request);

    if (!actor) {
      return errorResponse(unauthorizedFailure);
    }

    const rawInput = await readRequestInput(request, inputJsonSchema);

    if (!rawInput.ok) {
      return errorResponse(rawInput.failure);
    }

    const pathParams = context ? await context.params : {};
    const input = isPlainObject(rawInput.input)
      ? { ...rawInput.input, ...pathParams }
      : rawInput.input;

    const result = await executeOperation(actor, implementation, input);

    return result.ok ? jsonResponse(result.data) : errorResponse(result);
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readRequestInput(
  request: Request,
  inputJsonSchema: z.core.JSONSchema.BaseSchema
): Promise<{ ok: true; input: unknown } | { ok: false; failure: OperationFailure }> {
  if (request.method === "GET" || request.method === "HEAD") {
    return { ok: true, input: readQueryInput(new URL(request.url).searchParams, inputJsonSchema) };
  }

  const text = await request.text();

  if (text.trim() === "") {
    return { ok: true, input: {} };
  }

  try {
    return { ok: true, input: JSON.parse(text) };
  } catch {
    return {
      ok: false,
      failure: {
        status: 400,
        error: { code: "invalid-json", message: "The request body is not valid JSON." }
      }
    };
  }
}

/** The answer for any path or method under `/api/v1` that is not an endpoint. */
export function endpointNotFoundResponse() {
  return errorResponse({
    status: 404,
    error: {
      code: "endpoint-not-found",
      message: "There is no such endpoint. The endpoints are listed in /api/v1/openapi.json."
    }
  });
}
