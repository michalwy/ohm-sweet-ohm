import type { z } from "zod";

import { parseOperationInput, type Operation } from "@/server/api/operations";

/**
 * Validates a server action's input through its operation's schema (#279, #280), so the form,
 * REST and MCP accept the same shapes. Throws the error code (`invalid-input`) as an Error, as the
 * actions' own domain errors are thrown.
 */
export function parseActionInput<TInput extends z.ZodType>(
  operation: Pick<Operation<TInput, z.ZodType>, "input">,
  rawInput: unknown
): z.output<TInput> {
  const parsed = parseOperationInput(operation, rawInput);

  if (!parsed.ok) {
    throw new Error(parsed.error.code);
  }

  return parsed.data;
}
