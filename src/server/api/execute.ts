import "server-only";

import type { z } from "zod";

import { actorHasPermission, type WorkspaceActor } from "@/server/access-control/actor";
import {
  parseOperationInput,
  type Operation,
  type OperationError
} from "@/server/api/operations";
import { errorStatusForCode } from "@/server/api/errorStatus";

/**
 * An operation bound to the service function that performs it (ADR 0030, #274, #275).
 *
 * The REST endpoint and the MCP tool for an operation are two adapters over one implementation:
 * both call `executeOperation`, which checks the permission on the actor, validates the input,
 * runs the service function and checks its output against the schema. Neither adapter adds rules
 * of its own, so they cannot drift apart.
 */
export type OperationImplementation<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType
> = {
  operation: Operation<TInput, TOutput>;
  run: (actor: WorkspaceActor, input: z.output<TInput>) => Promise<z.input<TOutput>>;
};

export function implementOperation<TInput extends z.ZodType, TOutput extends z.ZodType>(
  operation: Operation<TInput, TOutput>,
  run: (actor: WorkspaceActor, input: z.output<TInput>) => Promise<z.input<TOutput>>
): OperationImplementation<TInput, TOutput> {
  return { operation, run };
}

/** An operation's failure: the shared error shape plus the HTTP status REST answers with. */
export type OperationFailure = { status: number; error: OperationError };

export type OperationResult<T> = { ok: true; data: T } | ({ ok: false } & OperationFailure);

export function permissionDeniedFailure(permission: string): OperationFailure {
  return {
    status: 403,
    error: {
      code: "permission-denied",
      message: `This token does not grant the "${permission}" permission in its workspace.`
    }
  };
}

/**
 * Runs an operation for an actor. The order is fixed: permission (403), input (400), the service
 * function (its domain error codes, `errorStatus.ts`), then the output schema — a service result
 * that does not match its own schema is a server defect (500), never sent half-checked.
 */
export async function executeOperation<TInput extends z.ZodType, TOutput extends z.ZodType>(
  actor: WorkspaceActor,
  implementation: OperationImplementation<TInput, TOutput>,
  rawInput: unknown
): Promise<OperationResult<z.output<TOutput>>> {
  const { operation } = implementation;

  if (operation.permission !== null && !actorHasPermission(actor, operation.permission)) {
    return { ok: false, ...permissionDeniedFailure(operation.permission) };
  }

  const input = parseOperationInput(operation, rawInput);

  if (!input.ok) {
    return { ok: false, status: 400, error: input.error };
  }

  let result: z.input<TOutput>;

  try {
    result = await implementation.run(actor, input.data);
  } catch (error) {
    return { ok: false, ...toOperationFailure(error) };
  }

  const output = operation.output.safeParse(result);

  if (!output.success) {
    console.error(`Operation ${operation.name} returned output outside its schema`, output.error);
    return { ok: false, ...internalErrorFailure() };
  }

  return { ok: true, data: output.data };
}

const domainErrorCode = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * A thrown error as the shared error shape. Domain functions throw `new Error("<kebab-code>")` (or
 * an `Error` subclass carrying such a `code`); those codes are passed on as they are. Anything else
 * is unexpected and is reported as `internal-error` without its message, which could carry internals.
 */
export function toOperationFailure(error: unknown): OperationFailure {
  const code = getDomainErrorCode(error);

  if (code === null) {
    console.error("Unexpected error in an API operation", error);
    return internalErrorFailure();
  }

  const details = getDomainErrorDetails(error);

  return {
    status: errorStatusForCode(code),
    error: { code, message: describeDomainError(code), ...(details ? { details } : {}) }
  };
}

/** A domain error's `details` (string values only), e.g. `ExchangeRateUnavailableError`'s (#282). */
function getDomainErrorDetails(error: unknown): Record<string, string> | null {
  if (!(error instanceof Error) || !("details" in error)) {
    return null;
  }

  const { details } = error as { details: unknown };

  if (typeof details !== "object" || details === null) {
    return null;
  }

  const entries = Object.entries(details).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  );

  return entries.length > 0 ? Object.fromEntries(entries) : null;
}

function getDomainErrorCode(error: unknown): string | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const candidate =
    "code" in error && typeof error.code === "string" ? error.code : error.message;

  return domainErrorCode.test(candidate) ? candidate : null;
}

function describeDomainError(code: string) {
  return `The operation failed: ${code.replaceAll("-", " ")}.`;
}

export function internalErrorFailure(): OperationFailure {
  return {
    status: 500,
    error: { code: "internal-error", message: "The server could not complete the operation." }
  };
}
