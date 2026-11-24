import { z } from "zod";

import type { PermissionKey } from "@/server/access-control/permissions";

/**
 * An operation's machine-readable contract (ADR 0030, #272).
 *
 * Each operation the public API and the MCP server expose is defined **once**: its
 * input and output as zod schemas, plus the permission it needs. From that one definition the
 * server validates input (`parseOperationInput`), and the OpenAPI document and the MCP tool
 * definitions derive their JSON Schemas (`getOperationJsonSchemas`). Server actions validate their
 * input through the same schema, so the UI, REST and MCP cannot accept different shapes.
 *
 * Conventions (`docs/agents/architecture.md` § *Operation schemas*):
 * - `name` is the stable MCP tool name, snake_case, verb first (`list_units`); never renamed.
 * - the input never carries the workspace: it comes from the actor (session slug or token).
 * - every field has a `.describe()`; agents read the descriptions.
 * - schemas use only what JSON Schema can express (no transforms or refinements whose meaning
 *   would be lost in the generated schema).
 */
export type Operation<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TPermission extends PermissionKey = PermissionKey
> = {
  name: string;
  description: string;
  permission: TPermission;
  input: TInput;
  output: TOutput;
};

export function defineOperation<
  TInput extends z.ZodType,
  TOutput extends z.ZodType,
  TPermission extends PermissionKey
>(operation: Operation<TInput, TOutput, TPermission>) {
  return operation;
}

/** The input as a caller sends it (before defaults and coercion). */
export type OperationInput<TOperation> =
  TOperation extends Operation<infer TInput, z.ZodType> ? z.input<TInput> : never;

export type OperationOutput<TOperation> =
  TOperation extends Operation<z.ZodType, infer TOutput> ? z.output<TOutput> : never;

/** One validation problem, addressed by its path in the input (`""` for the input itself). */
export type InputIssue = {
  path: string;
  code: string;
  message: string;
};

/**
 * The one error shape REST and MCP both return. `code` is a stable kebab-case string, like the
 * error codes server actions already report; `issues` is present for `invalid-input`.
 */
export type OperationError = {
  code: string;
  message: string;
  issues?: InputIssue[];
};

export type OperationInputResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: OperationError };

export function parseOperationInput<TInput extends z.ZodType>(
  operation: Pick<Operation<TInput, z.ZodType>, "input">,
  rawInput: unknown
): OperationInputResult<z.output<TInput>> {
  const result = operation.input.safeParse(rawInput);

  if (result.success) {
    return { ok: true, data: result.data };
  }

  return { ok: false, error: toInvalidInputError(result.error) };
}

export function toInvalidInputError(error: z.ZodError): OperationError {
  return {
    code: "invalid-input",
    message: "The input does not match the operation's schema.",
    issues: error.issues.map((issue) => ({
      path: issue.path.map(String).join("."),
      code: issue.code,
      message: issue.message
    }))
  };
}

type JsonSchema = z.core.JSONSchema.BaseSchema;

/**
 * The JSON Schemas (draft 2020-12, the dialect of OpenAPI 3.1 and of MCP tool definitions) of an
 * operation's input and output. The input is described as a caller may send it, the output as the
 * server returns it.
 */
export function getOperationJsonSchemas(
  operation: Pick<Operation<z.ZodType, z.ZodType>, "input" | "output">
): { input: JsonSchema; output: JsonSchema } {
  return {
    input: z.toJSONSchema(operation.input, { target: "draft-2020-12", io: "input" }),
    output: z.toJSONSchema(operation.output, { target: "draft-2020-12", io: "output" })
  };
}
