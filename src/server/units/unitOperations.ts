import { z } from "zod";

import { listPageInputShape, listPageOutputSchema } from "@/server/api/listSchemas";
import { defineOperation } from "@/server/api/operations";

export const unitSchema = z.object({
  id: z.string().describe("The unit's id."),
  name: z.string().describe("The unit's name, unique in the workspace, e.g. \"piece\"."),
  symbol: z.string().describe("The unit's symbol, e.g. \"pcs\"."),
  allowsFraction: z
    .boolean()
    .describe("Whether quantities in this unit may be fractional (e.g. metres of wire).")
});

export const unitListSortFields = ["name", "symbol", "allowsFraction"] as const;

/** The worked example of the operation-schema convention (#272). */
export const listUnitsOperation = defineOperation({
  name: "list_units",
  description: "List the workspace's units of measure, one page at a time.",
  permission: "units:read",
  input: z.object({
    ...listPageInputShape,
    sortBy: z
      .enum(unitListSortFields)
      .optional()
      .describe("Field to sort by; name when omitted.")
  }),
  output: listPageOutputSchema(unitSchema)
});

const unitIdInput = z.string().min(1).describe("The unit's id, as list_units returns it.");

export const createUnitOperation = defineOperation({
  name: "create_unit",
  description:
    "Create a unit of measure parts are counted in. The name must be unique in the workspace (case and spacing are ignored).",
  permission: "units:write",
  input: z.object({
    name: z.string().min(1).describe("The unit's name, e.g. \"metre\"."),
    symbol: z.string().min(1).describe("The unit's symbol, e.g. \"m\"."),
    allowsFraction: z
      .boolean()
      .describe("Whether quantities in this unit may be fractional (true for metres of wire, false for pieces).")
  }),
  output: unitSchema
});

export const updateUnitOperation = defineOperation({
  name: "update_unit",
  description: "Change a unit of measure. Fields left out keep their current value.",
  permission: "units:write",
  input: z.object({
    unitId: unitIdInput,
    name: z.string().min(1).optional().describe("The new name, unique in the workspace."),
    symbol: z.string().min(1).optional().describe("The new symbol."),
    allowsFraction: z
      .boolean()
      .optional()
      .describe("Whether quantities in this unit may be fractional.")
  }),
  output: unitSchema
});

export const deleteUnitOperation = defineOperation({
  name: "delete_unit",
  description:
    "Delete a unit of measure. A unit that parts are counted in cannot be deleted (unit-in-use).",
  permission: "units:write",
  input: z.object({ unitId: unitIdInput }),
  output: z.object({ id: z.string().describe("The deleted unit's id.") })
});
