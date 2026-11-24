import { z } from "zod";

import { DEFAULT_LIST_PAGE_SIZE, MAX_LIST_PAGE_SIZE } from "@/server/paginationLimits";

/** The cursor-paging input every list operation shares (see `src/server/pagination.ts`). */
export const listPageInputShape = {
  cursor: z
    .string()
    .nullish()
    .describe("Opaque cursor from the previous page's nextCursor; omit for the first page."),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(MAX_LIST_PAGE_SIZE)
    .nullish()
    .describe(`Items per page, 1–${MAX_LIST_PAGE_SIZE}; ${DEFAULT_LIST_PAGE_SIZE} when omitted.`),
  sortDir: z.enum(["asc", "desc"]).optional().describe("Sort direction; ascending when omitted.")
};

/** The page every list operation returns, for an item schema. */
export function listPageOutputSchema<TItem extends z.ZodType>(item: TItem) {
  return z.object({
    items: z.array(item).describe("The items of this page, in the requested order."),
    nextCursor: z
      .string()
      .nullable()
      .describe("Pass as cursor to get the next page; null on the last page."),
    totalCount: z.number().int().describe("Items in the workspace before any filter."),
    filteredCount: z.number().int().describe("Items matching the filters.")
  });
}
