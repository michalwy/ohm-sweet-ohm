import "server-only";

import type { WorkspaceActor } from "@/server/access-control/actor";
import { implementOperation } from "@/server/api/execute";
import { prisma } from "@/server/db/prisma";
import type { OperationInput } from "@/server/api/operations";
import { getPartsListPage, type PartsListItem } from "@/server/parts/getParts";
import {
  createPartForActor,
  deletePartForActor,
  updatePartForActor,
  type SupplierMatchingPayload
} from "@/server/parts/partMutations";
import {
  createPartOperation,
  deletePartOperation,
  getPartOperation,
  listPartsOperation,
  updatePartOperation
} from "@/server/parts/partOperations";

/**
 * Parts in the API and MCP (#277). The parts list's query (`getPartsListPage`) and the parts
 * dialog's domain code (`partMutations.ts`) serve the UI, REST and MCP alike; this module only maps
 * the operations' inputs and outputs onto them.
 */

export const listPartsImplementation = implementOperation(
  listPartsOperation,
  async (actor, input) => {
    const page = await getPartsListPage(actor, {
      cursor: input.cursor,
      pageSize: input.pageSize,
      sortBy: input.sortBy,
      sortDirection: input.sortDir,
      searchQuery: input.search,
      categoryFilterId: input.categoryId,
      manufacturerFilter: input.manufacturer,
      locationFilterId: input.locationId,
      stockQuantityFilter: input.stockFilter,
      attributeFilters: toAttributeFilterRecord(input.attributeFilters)
    });

    return { ...page, items: await withAttributeNames(actor, page.items) };
  }
);

export const getPartImplementation = implementOperation(getPartOperation, (actor, input) =>
  readPart(actor, input.id)
);

export const createPartImplementation = implementOperation(
  createPartOperation,
  async (actor, input) => {
    const { id } = await createPartForActor(actor, {
      catalogNumber: input.catalogNumber,
      manufacturerName: input.manufacturerName,
      unitId: input.unitId,
      description: emptyToNull(input.description),
      primaryCategoryId: emptyToNull(input.primaryCategoryId),
      secondaryCategoryId: emptyToNull(input.secondaryCategoryId),
      defaultLocationId: emptyToNull(input.defaultLocationId),
      attributeValues: { values: toAttributeValueMap(input.attributeValues), mode: "patch" },
      supplierMatching: input.supplierMatching
        ? await toSupplierMatchingPayload(actor, input.supplierMatching)
        : null
    });

    return readPart(actor, id);
  }
);

export const updatePartImplementation = implementOperation(
  updatePartOperation,
  async (actor, input) => {
    await updatePartForActor(actor, {
      id: input.id,
      catalogNumber: input.catalogNumber,
      manufacturerName: input.manufacturerName,
      unitId: input.unitId,
      description: optionalEmptyToNull(input.description),
      primaryCategoryId: optionalEmptyToNull(input.primaryCategoryId),
      secondaryCategoryId: optionalEmptyToNull(input.secondaryCategoryId),
      defaultLocationId: optionalEmptyToNull(input.defaultLocationId),
      attributeValues: { values: toAttributeValueMap(input.attributeValues), mode: "patch" }
    });

    return readPart(actor, input.id);
  }
);

export const deletePartImplementation = implementOperation(deletePartOperation, (actor, input) =>
  deletePartForActor(actor, input.id)
);

/** One part as the parts list shows it, or `part-not-found` (also for another workspace's part). */
async function readPart(actor: WorkspaceActor, id: string) {
  const page = await getPartsListPage(actor, { pinnedId: id });
  const [part] = await withAttributeNames(actor, page.items);

  if (!part) {
    throw new Error("part-not-found");
  }

  return part;
}

/** The list item's attribute values, each with its attribute's name, sorted by that name. */
async function withAttributeNames(actor: WorkspaceActor, items: PartsListItem[]) {
  const attributeIds = [
    ...new Set(items.flatMap((item) => item.attributeValues.map((value) => value.attributeId)))
  ];
  const attributes =
    attributeIds.length === 0
      ? []
      : await prisma.attribute.findMany({
          where: { id: { in: attributeIds }, workspaceId: actor.workspace.id },
          select: { id: true, name: true }
        });
  const namesById = new Map(attributes.map((attribute) => [attribute.id, attribute.name]));

  return items.map((item) => ({
    ...item,
    attributeValues: item.attributeValues
      .map((value) => ({
        attributeId: value.attributeId,
        attributeName: namesById.get(value.attributeId) ?? "",
        displayValue: value.displayValue
      }))
      .sort((a, b) => a.attributeName.localeCompare(b.attributeName, "en"))
  }));
}

function toAttributeFilterRecord(filters: string[] | undefined) {
  if (!filters?.length) {
    return null;
  }

  return Object.fromEntries(
    filters.map((filter) => {
      const separator = filter.indexOf("=");
      return [filter.slice(0, separator), filter.slice(separator + 1)];
    })
  );
}

function toAttributeValueMap(values: Record<string, string | null> | undefined) {
  return new Map(Object.entries(values ?? {}).map(([id, value]) => [id, value ?? ""]));
}

function emptyToNull(value: string | null | undefined) {
  return value ? value : null;
}

function optionalEmptyToNull(value: string | null | undefined) {
  return value === undefined ? undefined : emptyToNull(value);
}

/**
 * `create_part`'s accepted supplier matches (#285), as the add-part dialog submits them. The
 * category and attributes they name must be the workspace's own: an id of another workspace is not
 * found, so the API cannot plant another workspace's ids in this one's matching statistics.
 */
async function toSupplierMatchingPayload(
  actor: WorkspaceActor,
  matching: NonNullable<OperationInput<typeof createPartOperation>["supplierMatching"]>
): Promise<SupplierMatchingPayload> {
  const workspaceId = actor.workspace.id;
  const targetCategoryId = matching.targetCategoryId || null;

  if (targetCategoryId) {
    const category = await prisma.partCategory.findFirst({
      where: { id: targetCategoryId, workspaceId },
      select: { id: true }
    });

    if (!category) {
      throw new Error("category-not-found");
    }
  }

  const attributeIds = [...new Set(matching.attributeMappings.map((item) => item.targetAttributeId))];
  const attributeCount = attributeIds.length
    ? await prisma.attribute.count({ where: { id: { in: attributeIds }, workspaceId } })
    : 0;

  if (attributeCount !== attributeIds.length) {
    throw new Error("attribute-not-found");
  }

  return {
    mode: "create-from-suggestion",
    provider: matching.provider,
    sourceCategoryKey: matching.sourceCategoryKey,
    sourceManufacturerKey: matching.sourceManufacturerKey,
    targetCategoryId,
    attributeMappings: matching.attributeMappings.map((item) => ({
      sourceAttributeKey: item.sourceAttributeKey,
      targetAttributeId: item.targetAttributeId
    }))
  };
}
