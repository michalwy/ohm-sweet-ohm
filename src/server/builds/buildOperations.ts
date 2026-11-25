import { z } from "zod";

import { listPageInputShape, listPageOutputSchema } from "@/server/api/listSchemas";
import { defineOperation } from "@/server/api/operations";

/**
 * Builds in the API and MCP (#284). Pure, so unit tests and the OpenAPI document can load it; the
 * implementations are in `buildApi.ts`, over the same domain functions (`builds.ts`) as the server
 * actions in `buildActions.ts`, with the same stock effects.
 */

const buildIdSchema = z.string().min(1).describe("The build's id.");
const partIdSchema = z.string().min(1).describe("The part's id.");

const buildStateSchema = z
  .enum(["ALLOCATING", "STARTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
  .describe(
    "ALLOCATING: parts are being planned (soft allocations); STARTED: stock is reserved per designator and unit; IN_PROGRESS: at least one designator is assembled; COMPLETED: every designator is assembled and the output part was received; CANCELLED: released."
  );

const unitStatusSchema = z
  .enum(["not_started", "in_progress", "complete"])
  .describe("How far one physical unit is assembled.");

const locationRefSchema = z.object({
  id: z.string().describe("The storage location's id."),
  name: z.string().describe("The location's name."),
  path: z.string().describe('The location\'s full path, e.g. "Warehouse / Shelf A / Drawer 5".')
});

const partRefSchema = z.object({
  id: z.string().describe("The part's id."),
  catalogNumber: z.string().describe("The part's catalog number.")
});

const storageLocationSchema = z.object({
  id: z.string().describe("The storage location's id."),
  parentId: z.string().nullable().describe("The parent location's id; null at the top level."),
  name: z.string().describe("The location's name."),
  isAssignable: z.boolean().describe("Whether stock can be stored at this location."),
  isArchived: z.boolean().describe("Whether the location is archived.")
});

const allocationEntrySchema = z.object({
  partId: partIdSchema,
  sourceLocationId: z
    .string()
    .nullable()
    .describe(
      "The storage location to take the parts from; null plans against incoming stock (on order or in production), which keeps the build from starting until it is replaced by on-hand stock."
    ),
  quantity: z.number().int().min(1).describe("How many units of the part this entry covers.")
});

const allocationEntriesSchema = z
  .array(allocationEntrySchema)
  .describe(
    "The line's whole allocation, replacing what it had; an empty array clears it. Partial totals are allowed while allocating; start_build requires every line to be fully allocated from on-hand stock."
  );

export const buildSummarySchema = z.object({
  id: z.string().describe("The build's id."),
  designName: z.string().describe("The built design's name."),
  revisionNumber: z.number().int().describe("The built design revision's number."),
  outputPartCatalogNumber: z.string().describe("The catalog number of the part the build produces."),
  targetQuantity: z.number().int().describe("How many units the build produces."),
  state: buildStateSchema,
  unitsTotal: z
    .number()
    .int()
    .describe("Designator-units the build needs: designators of every line × target quantity."),
  unitsAllocated: z.number().int().describe("Designator-units covered by allocation entries."),
  unitsAssembled: z.number().int().describe("Designator-units already assembled."),
  createdAt: z.iso.datetime().describe("When the build was created (ISO 8601, UTC)."),
  updatedAt: z.iso.datetime().describe("When the build last changed (ISO 8601, UTC).")
});

const matchCandidateSchema = z.object({
  id: z.string().describe("The candidate part's id."),
  catalogNumber: z.string().describe("The part's catalog number."),
  description: z.string().nullable().describe("The part's description."),
  manufacturerName: z.string().describe("The part's manufacturer."),
  onHandAvailableQuantity: z
    .string()
    .describe("Physically on hand and not reserved (current stock − reserved), as a decimal string."),
  incomingAvailableQuantity: z
    .string()
    .describe("Incoming (on order + in production), as a decimal string: can be planned against, not started against.")
});

const buildLineSchema = z.object({
  id: z.string().describe("The build line's id (buildLineItemId in the allocation operations)."),
  sourceBomLineItemId: z
    .string()
    .nullable()
    .describe("The BOM line it was frozen from; null when that line was deleted since."),
  designators: z.string().describe('The line\'s designators, e.g. "R1, R2, R3".'),
  designatorCount: z.number().int().describe("How many designators the line has."),
  categoryName: z.string().nullable().describe("The line's frozen category path; null when none."),
  requiredUnits: z.number().int().describe("Parts the line needs: designators × target quantity."),
  allocations: z
    .array(
      z.object({
        id: z.string().describe("The allocation entry's id."),
        part: partRefSchema.extend({
          onHandAvailableQuantity: z.string().describe("The part's on-hand available quantity."),
          incomingAvailableQuantity: z.string().describe("The part's incoming quantity.")
        }),
        sourceLocation: locationRefSchema.nullable().describe("Where the parts come from; null for incoming stock."),
        quantity: z.number().int().describe("How many units this entry covers.")
      })
    )
    .describe("The line's allocation entries (while allocating, and kept after the start)."),
  assignments: z
    .array(
      z.object({
        id: z.string().describe("The assignment's id (assignmentId in the assemble and reassign operations)."),
        designator: z.string().describe("The designator, e.g. R1."),
        unitIndex: z.number().int().describe("The physical unit, from 1."),
        part: partRefSchema.nullable().describe("The part placed at this designator."),
        sourceLocation: locationRefSchema.nullable().describe("Where it is taken from."),
        assembled: z.boolean().describe("Whether it is assembled.")
      })
    )
    .describe("One entry per designator and unit, created when the build starts."),
  matchCandidates: z
    .array(matchCandidateSchema)
    .describe("Parts that satisfy the line's pinned part or matchers; filled while the build is not finished."),
  partBalances: z
    .array(
      z.object({
        partId: z.string().describe("The part's id."),
        balances: z
          .array(
            z.object({
              locationId: z.string().describe("The storage location's id."),
              balance: z.string().describe("The part's stock there, as a decimal string.")
            })
          )
          .describe("Non-zero stock per location.")
      })
    )
    .describe("Where the line's candidate and allocated parts are stored."),
  matchSpec: z
    .object({
      pinnedPart: partRefSchema.nullable().describe("The part the BOM line is pinned to, if any."),
      matchers: z
        .array(
          z.object({
            attributeId: z.string().describe("The attribute's id."),
            attributeName: z.string().describe("The attribute's name."),
            operator: z.enum(["EQ", "NEQ", "LT", "LTE", "GT", "GTE"]).describe("The comparison."),
            displayValue: z.string().nullable().describe("The compared value, as displayed.")
          })
        )
        .describe("The attribute conditions a part must meet.")
    })
    .nullable()
    .describe("What a part must be to fit the line; null once the build is finished.")
});

export const buildSchema = z.object({
  id: z.string().describe("The build's id."),
  designName: z.string().describe("The built design's name."),
  revisionId: z.string().describe("The built design revision's id."),
  revisionNumber: z.number().int().describe("The built design revision's number."),
  targetQuantity: z.number().int().describe("How many units the build produces."),
  state: buildStateSchema,
  outputPart: partRefSchema.describe("The part the build produces."),
  outputLocation: z
    .object({ id: z.string(), name: z.string() })
    .nullable()
    .describe("Where the output part is received on completion."),
  startedAt: z.iso.datetime().nullable().describe("When the build was started; null before."),
  completedAt: z.iso.datetime().nullable().describe("When the build completed; null before."),
  cancelledAt: z.iso.datetime().nullable().describe("When the build was cancelled; null unless cancelled."),
  createdAt: z.iso.datetime().describe("When the build was created (ISO 8601, UTC)."),
  locations: z
    .array(storageLocationSchema)
    .describe("The workspace's storage locations, while the build is not finished; empty otherwise."),
  lines: z.array(buildLineSchema).describe("The build's lines, frozen from the revision's BOM."),
  units: z
    .array(
      z.object({
        unitIndex: z.number().int().describe("The physical unit, from 1."),
        status: unitStatusSchema,
        designators: z
          .array(
            z.object({
              assignmentId: z.string().describe("The assignment's id."),
              lineItemId: z.string().describe("The build line's id."),
              designator: z.string().describe("The designator."),
              categoryName: z.string().nullable().describe("The line's category path."),
              part: partRefSchema.nullable().describe("The part placed there."),
              sourceLocation: locationRefSchema.nullable().describe("Where it is taken from."),
              assembled: z.boolean().describe("Whether it is assembled.")
            })
          )
          .describe("Every designator of the unit.")
      })
    )
    .describe("Per physical unit, once the build is started."),
  allocationWarnings: z
    .array(
      z.object({
        lineItemId: z.string().describe("The build line's id."),
        partId: z.string().describe("The part's id."),
        partCatalogNumber: z.string().describe("The part's catalog number."),
        sourceLocation: locationRefSchema.nullable().describe("The entry's source location."),
        requiredQuantity: z.number().int().describe("How many the entry needs."),
        reason: z
          .enum(["insufficient-available-stock", "insufficient-location-stock"])
          .describe("Which check start_build would fail.")
      })
    )
    .describe("While allocating: entries that stock moved under since they were saved, so start_build would refuse them.")
});

const buildStateResultSchema = z.object({
  buildId: z.string().describe("The build's id."),
  state: buildStateSchema
});

export const listBuildsOperation = defineOperation({
  name: "list_builds",
  description:
    "List the workspace's builds, one page at a time, with allocation and assembly progress. get_build returns a build's lines, allocations and units.",
  permission: "builds:read",
  input: z.object({
    ...listPageInputShape,
    sortBy: z
      .enum(["design", "revision", "targetQuantity", "state", "createdAt"])
      .optional()
      .describe("Sort key; createdAt when omitted."),
    sortDir: z
      .enum(["asc", "desc"])
      .optional()
      .describe("Sort direction; descending when omitted."),
    searchQuery: z.string().nullish().describe("Only builds whose design name contains this text, ignoring case."),
    stateFilter: buildStateSchema.nullish().describe("Only builds in this state."),
    createdAtFilter: z
      .string()
      .nullish()
      .describe(
        "Only builds created in a date range: after:YYYY-MM-DD, before:YYYY-MM-DD or between:YYYY-MM-DD:YYYY-MM-DD."
      ),
    designIdFilter: z.string().nullish().describe("Only builds of this design.")
  }),
  output: listPageOutputSchema(buildSummarySchema)
});

export const getBuildOperation = defineOperation({
  name: "get_build",
  description:
    "One build, by id: its lines with allocation entries, matching candidate parts and their stock per location; once started, its per-designator assignments grouped by unit; while allocating, warnings for entries start_build would refuse.",
  permission: "builds:read",
  input: z.object({ buildId: buildIdSchema }),
  output: buildSchema
});

export const getBuildCreateOptionsOperation = defineOperation({
  name: "get_build_create_options",
  description:
    "What create_build takes: every design with its revisions (newest first), its output part and that part's default location, the workspace's storage locations and its default location.",
  permission: "builds:write",
  input: z.object({}),
  output: z.object({
    designs: z
      .array(
        z.object({
          id: z.string().describe("The design's id."),
          name: z.string().describe("The design's name."),
          outputPartCatalogNumber: z.string().describe("The catalog number of the part it produces."),
          defaultLocationId: z
            .string()
            .nullable()
            .describe("The output part's default location; the UI preselects it as the output location."),
          revisions: z
            .array(
              z.object({
                id: z.string().describe("The revision's id (designRevisionId of create_build)."),
                revisionNumber: z.number().int().describe("The revision's number.")
              })
            )
            .describe("The design's revisions, newest first.")
        })
      )
      .describe("The workspace's designs, by name."),
    locations: z.array(storageLocationSchema).describe("The workspace's storage locations."),
    workspaceDefaultLocationId: z
      .string()
      .nullable()
      .describe(
        "The workspace's default location; the UI preselects it as the output location when the output part has no default location of its own."
      )
  })
});

export const createBuildOperation = defineOperation({
  name: "create_build",
  description:
    "Create a build of a design revision: its BOM is frozen into build lines, and the build starts in ALLOCATING with each line pre-filled, as in the UI, with a suggested allocation from available stock (change it with set_build_allocations). Answers the new build.",
  permission: "builds:write",
  input: z.object({
    designRevisionId: z.string().min(1).describe("The design revision to build."),
    targetQuantity: z.number().int().min(1).describe("How many units to build."),
    outputLocationId: z
      .string()
      .min(1)
      .describe("The storage location the output part is received into when the build completes.")
  }),
  output: buildSchema
});

export const deleteBuildOperation = defineOperation({
  name: "delete_build",
  description:
    "Delete a build that is still ALLOCATING or was cancelled, releasing its allocations; a started or completed build cannot be deleted (build-not-deletable).",
  permission: "builds:write",
  input: z.object({ buildId: buildIdSchema }),
  output: z.object({ buildId: z.string().describe("The deleted build's id.") })
});

export const setBuildLineAllocationsOperation = defineOperation({
  name: "set_build_line_allocations",
  description:
    "Replace the allocation of one line of an ALLOCATING build with the entries sent; they are checked against available stock and each location's balance. Answers the build.",
  permission: "builds:write",
  input: z.object({
    buildId: buildIdSchema,
    lineId: z.string().min(1).describe("The build line's id."),
    entries: allocationEntriesSchema
  }),
  output: buildSchema
});

export const setBuildAllocationsOperation = defineOperation({
  name: "set_build_allocations",
  description:
    "Replace the allocation of every line of an ALLOCATING build at once, checked against stock together and saved atomically, as the UI's allocation editor does. This is the build's whole allocation: a line not sent is left with none. Answers the build.",
  permission: "builds:write",
  input: z.object({
    buildId: buildIdSchema,
    lines: z
      .array(
        z.object({
          buildLineItemId: z.string().min(1).describe("The build line's id."),
          entries: allocationEntriesSchema
        })
      )
      .describe("The lines and their entries.")
  }),
  output: buildSchema
});

export const reassignBuildDesignatorOperation = defineOperation({
  name: "reassign_build_designator",
  description:
    "Change the part or source location of one not yet assembled designator of a started build, moving its reservation; the part must fit the line. Answers the build.",
  permission: "builds:write",
  input: z.object({
    buildId: buildIdSchema,
    assignmentId: z.string().min(1).describe("The designator assignment's id."),
    partId: partIdSchema,
    sourceLocationId: z.string().nullable().describe("The storage location to take it from.")
  }),
  output: buildSchema
});

export const startBuildOperation = defineOperation({
  name: "start_build",
  description:
    "Start a fully allocated build (every line covered from on-hand stock): allocations become per-designator, per-unit reservations, and the output part counts as in production.",
  permission: "builds:write",
  input: z.object({ buildId: buildIdSchema }),
  output: buildStateResultSchema
});

export const assembleBuildDesignatorOperation = defineOperation({
  name: "assemble_build_designator",
  description:
    "Assemble one designator of one unit: its part is issued from its source location and its reservation released. When it was the last one, the build completes and the output part is received.",
  permission: "builds:write",
  input: z.object({
    buildId: buildIdSchema,
    assignmentId: z.string().min(1).describe("The designator assignment's id.")
  }),
  output: buildStateResultSchema.extend({
    completed: z.boolean().describe("Whether this completed the build.")
  })
});

export const assembleBuildUnitOperation = defineOperation({
  name: "assemble_build_unit",
  description:
    "Assemble every remaining designator of one physical unit, as assemble_build_designator does for each. When it was the last unit, the build completes and the output part is received.",
  permission: "builds:write",
  input: z.object({
    buildId: buildIdSchema,
    unitIndex: z.number().int().min(1).describe("The physical unit, from 1.")
  }),
  output: buildStateResultSchema.extend({
    completed: z.boolean().describe("Whether this completed the build.")
  })
});

export const cancelBuildOperation = defineOperation({
  name: "cancel_build",
  description:
    "Cancel a build that is not finished: its allocations and the reservations of designators not yet assembled are released; parts already assembled stay issued.",
  permission: "builds:write",
  input: z.object({ buildId: buildIdSchema }),
  output: buildStateResultSchema
});

export const getBuildPickListOperation = defineOperation({
  name: "get_build_pick_list",
  description:
    "The pick list of a build that is ALLOCATING, STARTED or IN_PROGRESS: how many of each part to gather from each location, grouped by location. Other states answer build-pick-list-unavailable.",
  permission: "builds:read",
  input: z.object({ buildId: buildIdSchema }),
  output: z.object({
    id: z.string().describe("The build's id."),
    designName: z.string().describe("The built design's name."),
    revisionNumber: z.number().int().describe("The built revision's number."),
    targetQuantity: z.number().int().describe("How many units the build produces."),
    state: buildStateSchema,
    groups: z
      .array(
        z.object({
          locationId: z.string().nullable().describe("The location; null for incoming stock."),
          locationPath: z.string().describe("The location's full path."),
          entries: z
            .array(
              z.object({
                partId: z.string().describe("The part's id."),
                catalogNumber: z.string().describe("The part's catalog number."),
                manufacturerName: z.string().describe("The part's manufacturer."),
                categoryName: z.string().nullable().describe("The line's category path."),
                totalQuantity: z.number().int().describe("How many to pick from this location."),
                assembledQuantity: z.number().int().describe("How many of them are already assembled.")
              })
            )
            .describe("The parts to pick there.")
        })
      )
      .describe("One group per source location.")
  })
});

export const getBuildAssemblyListOperation = defineOperation({
  name: "get_build_assembly_list",
  description:
    "The assembly list of a build that is STARTED, IN_PROGRESS or COMPLETED: per physical unit, every designator with its part and source location, in designator order. Other states answer build-assembly-list-unavailable.",
  permission: "builds:read",
  input: z.object({ buildId: buildIdSchema }),
  output: z.object({
    id: z.string().describe("The build's id."),
    designName: z.string().describe("The built design's name."),
    revisionNumber: z.number().int().describe("The built revision's number."),
    targetQuantity: z.number().int().describe("How many units the build produces."),
    state: buildStateSchema,
    units: z
      .array(
        z.object({
          unitIndex: z.number().int().describe("The physical unit, from 1."),
          status: unitStatusSchema,
          entries: z
            .array(
              z.object({
                assignmentId: z.string().describe("The designator assignment's id."),
                designator: z.string().describe("The designator."),
                categoryName: z.string().nullable().describe("The line's category path."),
                part: partRefSchema
                  .extend({ manufacturerName: z.string().describe("The part's manufacturer.") })
                  .nullable()
                  .describe("The part placed there."),
                sourceLocation: locationRefSchema.nullable().describe("Where it is taken from."),
                assembled: z.boolean().describe("Whether it is assembled.")
              })
            )
            .describe("The unit's designators.")
        })
      )
      .describe("One entry per physical unit.")
  })
});

const partBuildReferenceShape = {
  buildId: z.string().describe("The build's id."),
  designName: z.string().describe("The built design's name."),
  revisionNumber: z.number().int().describe("The built revision's number."),
  targetQuantity: z.number().int().describe("How many units the build produces."),
  state: buildStateSchema
};

export const getPartBuildAllocationsOperation = defineOperation({
  name: "get_part_build_allocations",
  description:
    "The builds holding a part: allocated (soft, while ALLOCATING) or reserved (per designator not yet assembled, while STARTED or IN_PROGRESS), newest first.",
  permission: "builds:read",
  input: z.object({ id: partIdSchema }),
  output: z.object({
    items: z
      .array(
        z.object({
          ...partBuildReferenceShape,
          allocatedQty: z.number().int().describe("Units of the part allocated by the build."),
          reservedQty: z.number().int().describe("Units of the part reserved by the build.")
        })
      )
      .describe("One entry per build.")
  })
});

export const getPartProductionBuildsOperation = defineOperation({
  name: "get_part_production_builds",
  description: "The started builds producing a part as their output, newest first.",
  permission: "builds:read",
  input: z.object({ id: partIdSchema }),
  output: z.object({
    items: z
      .array(
        z.object({
          ...partBuildReferenceShape,
          inProductionQty: z.number().int().describe("Units of the part the build will produce.")
        })
      )
      .describe("One entry per build.")
  })
});
