import { z } from "zod";

import {
  LOCATION_GENERATOR_MAX_NEW,
  LOCATION_GENERATOR_MAX_PAD_DIGITS,
  LOCATION_GENERATOR_MAX_PLANNED
} from "@/lib/locationGenerator";
import { defineOperation } from "@/server/api/operations";

/**
 * Storage locations in the API and MCP (#280). Pure, so unit tests and the OpenAPI document can
 * load it; the implementations are in `locationApi.ts`, and the server actions in
 * `locationActions.ts` validate their input through the same schemas.
 */

const locationIdSchema = z.string().min(1).describe("The location's id.");

const parentIdSchema = z
  .string()
  .min(1)
  .nullable()
  .describe("The parent location's id; null for a top-level location.");

const nameSchema = z
  .string()
  .describe(
    "The location's name, unique among its siblings (ignoring case and repeated spaces); surrounding spaces are trimmed."
  );

const isAssignableSchema = z
  .boolean()
  .describe(
    "true for a location that holds stock (a drawer, a bin); false for an organizational one (a room, a cabinet) that only groups other locations and cannot be used in stock movements."
  );

export const locationSchema = z.object({
  id: z.string().describe("The location's id."),
  parentId: z.string().nullable().describe("The parent location's id; null at the top level."),
  name: z.string().describe("The location's own name."),
  path: z
    .string()
    .describe("The full path from the top level, names joined with \" / \" (e.g. \"Cabinet A / Drawer 5\")."),
  isAssignable: z
    .boolean()
    .describe("Whether the location holds stock (false: organizational, only groups locations)."),
  isArchived: z
    .boolean()
    .describe("Archived locations keep showing their stock history but cannot be used in new stock movements.")
});

export const listLocationsOperation = defineOperation({
  name: "list_locations",
  description:
    "The workspace's whole storage location tree as a flat list (each location with its parentId and full path), archived locations included, sorted by name.",
  permission: "locations:read",
  input: z.object({}),
  output: z.object({ items: z.array(locationSchema).describe("Every location of the workspace.") })
});

export const getLocationOperation = defineOperation({
  name: "get_location",
  description: "One storage location of the workspace, by id.",
  permission: "locations:read",
  input: z.object({ id: locationIdSchema }),
  output: locationSchema
});

export const createLocationOperation = defineOperation({
  name: "create_location",
  description:
    "Create a storage location, at the top level or under a parent. Its name must be unique among its siblings.",
  permission: "locations:write",
  input: z.object({
    parentId: parentIdSchema.optional(),
    name: nameSchema,
    isAssignable: isAssignableSchema
  }),
  output: locationSchema
});

export const updateLocationOperation = defineOperation({
  name: "update_location",
  description:
    "Change a storage location: rename it, move it under another parent (null: to the top level), change whether it holds stock, or archive/unarchive it. Only the fields sent change. Archiving is refused while any part has non-zero stock there (location-has-stock).",
  permission: "locations:write",
  input: z.object({
    id: locationIdSchema,
    parentId: parentIdSchema.optional(),
    name: nameSchema.optional(),
    isAssignable: isAssignableSchema.optional(),
    isArchived: z
      .boolean()
      .optional()
      .describe("true archives the location (only with zero stock of every part), false restores it.")
  }),
  output: locationSchema
});

export const deleteLocationOperation = defineOperation({
  name: "delete_location",
  description:
    "Delete a storage location. Refused while it has child locations (location-has-children), or while any part uses it as default location or any stock movement names it (location-in-use) — archive it instead.",
  permission: "locations:write",
  input: z.object({ id: locationIdSchema }),
  output: z.object({ id: z.string().describe("The deleted location's id.") })
});

const generatorLevelSchema = z.object({
  prefix: z
    .string()
    .describe(
      "Text before the counter. {1}, {2}, … insert the counter of that level (1 = the top level of this run), e.g. \"Bin {1}-\" under a shelf counter gives \"Bin 2-01\"."
    ),
  suffix: z.string().describe("Text after the counter; may use {1}, {2}, … like prefix."),
  counter: z
    .enum(["numeric", "alphabetic"])
    .describe("\"numeric\" counts 1, 2, 3…; \"alphabetic\" counts A, B, … Z, AA…"),
  start: z
    .string()
    .describe("The first counter value: digits for a numeric counter, 1–3 letters for an alphabetic one."),
  count: z
    .number()
    .int()
    .min(1)
    .max(LOCATION_GENERATOR_MAX_NEW)
    .describe("How many locations this level creates under each location of the level above."),
  padding: z
    .union([z.literal("auto"), z.number().int().min(1).max(LOCATION_GENERATOR_MAX_PAD_DIGITS)])
    .describe(
      "Numeric counters: \"auto\" pads to the width of the level's largest value (01…12), a number is the minimum digit count."
    ),
  isAssignable: isAssignableSchema
});

export const generateLocationsOperation = defineOperation({
  name: "generate_locations",
  description: `Create a whole location hierarchy at once, as the location generator does: each level is a counter wrapped in a prefix and suffix, and every location of a level gets the whole next level below it. A location whose name already exists under the same parent is reused untouched, so running it again only adds what is missing. At most ${LOCATION_GENERATOR_MAX_NEW} new and ${LOCATION_GENERATOR_MAX_PLANNED} planned locations per run.`,
  permission: "locations:write",
  input: z.object({
    parentId: parentIdSchema
      .optional()
      .describe("The location to generate under; null or omitted for the top level."),
    levels: z
      .array(generatorLevelSchema)
      .min(1)
      .describe("The levels, top first.")
  }),
  output: z.object({
    created: z.array(locationSchema).describe("The locations created, parents before children."),
    reusedCount: z
      .number()
      .int()
      .describe("How many planned locations already existed and were reused.")
  })
});
