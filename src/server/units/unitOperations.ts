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
