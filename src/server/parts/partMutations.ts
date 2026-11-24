import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { requireActorPermission, type WorkspaceActor } from "@/server/access-control/actor";
import { prisma } from "@/server/db/prisma";
import { learnSupplierMatching } from "@/server/integrations/matchingLearning";
import type { SupplierProviderKey } from "@/server/integrations/types";
import {
  ensureOrganizationWithRole,
  ORGANIZATION_ROLE_MANUFACTURER
} from "@/server/organizations/organizations";
import {
  getEffectivePartCategoryAttributes,
  type EffectiveCategoryAttribute
} from "@/server/parts/attributes";
import { parseAttributeValue } from "@/server/parts/attributeValues";
import { updatePartValueSortNumber } from "@/server/parts/partValueSort";

/**
 * Creating, changing and deleting a part, for an actor (#277). The one domain code behind the parts
 * dialog's server actions (`createPart.ts`) and the API's `create_part`, `update_part` and
 * `delete_part` (`partsApi.ts`). Kept out of the `"use server"` module so these functions are not
 * themselves callable from the browser (#295).
 *
 * Every read and write is scoped to `actor.workspace.id`. Failures throw `Error("<kebab-code>")`:
 * `part-not-found`, `duplicate-part`, `part-in-use`, `invalid-unit`, `invalid-category`,
 * `secondary-without-primary`, `duplicate-categories`, `invalid-default-location`,
 * `invalid-attribute-value`, `invalid-attribute`; anything else is unexpected and rethrown as it is.
 *
 * Part attribute values survive category changes (`docs/agents/architecture.md`): only attributes
 * effective for the part's categories are ever written or cleared, so a value of an attribute that
 * stops being effective stays stored and comes back when the attribute does.
 */

export type PartFields = {
  unitId: string;
  catalogNumber: string;
  description: string | null;
  manufacturerName: string;
  primaryCategoryId: string | null;
  secondaryCategoryId: string | null;
  defaultLocationId: string | null;
};

/**
 * Submitted attribute values, by attribute id; an empty string clears the value.
 *
 * - `"form"` (the parts dialog): the values of every effective attribute are submitted, so an
 *   effective attribute missing from the map is cleared; ids that are not effective are ignored.
 * - `"patch"` (the API): only the attributes in the map change, the others keep their values; an id
 *   that is not effective for the part's categories is refused with `invalid-attribute`.
 */
export type PartAttributeValuesInput = {
  values: Map<string, string>;
  mode: "form" | "patch";
};

export type SupplierMatchingPayload = {
  mode: "create-from-suggestion";
  provider: SupplierProviderKey;
  sourceCategoryKey: string;
  sourceManufacturerKey: string;
  targetCategoryId: string | null;
  attributeMappings: Array<{
    sourceAttributeKey: string;
    targetAttributeId: string;
  }>;
};

export async function createPartForActor(
  actor: WorkspaceActor,
  input: PartFields & {
    attributeValues: PartAttributeValuesInput;
    supplierMatching?: SupplierMatchingPayload | null;
  }
): Promise<{ id: string }> {
  requireActorPermission(actor, "parts:write");

  const workspaceId = actor.workspace.id;

  await validatePartCategoryAssignment({
    workspaceId,
    primaryCategoryId: input.primaryCategoryId,
    secondaryCategoryId: input.secondaryCategoryId
  });
  await validatePartUnit({ workspaceId, unitId: input.unitId });

  const attributeValueWrites = await getAttributeValueWrites({
    workspaceId,
    primaryCategoryId: input.primaryCategoryId,
    secondaryCategoryId: input.secondaryCategoryId,
    attributeValues: input.attributeValues
  });

  await validateDefaultLocation({ workspaceId, defaultLocationId: input.defaultLocationId });

  const manufacturer = await ensureOrganizationWithRole({
    workspaceId,
    name: input.manufacturerName,
    role: ORGANIZATION_ROLE_MANUFACTURER
  });
  const supplierMatching = input.supplierMatching ?? null;

  try {
    return await prisma.$transaction(async (tx) => {
      const part = await tx.part.create({
        data: {
          workspaceId,
          unitId: input.unitId,
          catalogNumber: input.catalogNumber,
          description: input.description,
          manufacturerId: manufacturer.id,
          primaryCategoryId: input.primaryCategoryId,
          secondaryCategoryId: input.secondaryCategoryId,
          defaultLocationId: input.defaultLocationId
        },
        select: { id: true }
      });

      await syncPartAttributeValues({ tx, workspaceId, partId: part.id, attributeValueWrites });
      await updatePartValueSortNumber({
        tx,
        workspaceId,
        partId: part.id,
        primaryCategoryId: input.primaryCategoryId
      });

      if (supplierMatching) {
        await learnSupplierMatching({
          tx,
          workspaceId,
          provider: supplierMatching.provider,
          sourceCategoryKey: supplierMatching.sourceCategoryKey,
          targetCategoryId: supplierMatching.targetCategoryId,
          attributeMappings: supplierMatching.attributeMappings,
          sourceManufacturerKey: supplierMatching.sourceManufacturerKey,
          targetManufacturerId: manufacturer.id
        });
      }

      return part;
    });
  } catch (error) {
    throw toPartWriteError(error);
  }
}

/**
 * Changes a part. A field left `undefined` keeps its current value and is not validated again (so
 * a part whose default location was archived since can still have its description changed); the
 * parts dialog always sends every field.
 */
export async function updatePartForActor(
  actor: WorkspaceActor,
  input: { id: string } & Partial<PartFields> & { attributeValues: PartAttributeValuesInput }
): Promise<{ id: string }> {
  requireActorPermission(actor, "parts:write");

  const workspaceId = actor.workspace.id;
  const current = await prisma.part.findFirst({
    where: { id: input.id, workspaceId },
    select: {
      unitId: true,
      catalogNumber: true,
      description: true,
      manufacturer: { select: { name: true } },
      primaryCategoryId: true,
      secondaryCategoryId: true,
      defaultLocationId: true
    }
  });

  if (!current) {
    throw new Error("part-not-found");
  }

  const categoriesChanged =
    input.primaryCategoryId !== undefined || input.secondaryCategoryId !== undefined;
  const primaryCategoryId =
    input.primaryCategoryId !== undefined ? input.primaryCategoryId : current.primaryCategoryId;
  const secondaryCategoryId =
    input.secondaryCategoryId !== undefined
      ? input.secondaryCategoryId
      : current.secondaryCategoryId;

  if (categoriesChanged) {
    await validatePartCategoryAssignment({ workspaceId, primaryCategoryId, secondaryCategoryId });
  }

  if (input.unitId !== undefined) {
    await validatePartUnit({ workspaceId, unitId: input.unitId });
  }

  const attributeValueWrites = await getAttributeValueWrites({
    workspaceId,
    primaryCategoryId,
    secondaryCategoryId,
    attributeValues: input.attributeValues
  });

  if (input.defaultLocationId !== undefined) {
    await validateDefaultLocation({ workspaceId, defaultLocationId: input.defaultLocationId });
  }

  const manufacturerName = input.manufacturerName ?? current.manufacturer.name;
  const manufacturer = await ensureOrganizationWithRole({
    workspaceId,
    name: manufacturerName,
    role: ORGANIZATION_ROLE_MANUFACTURER
  });

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.part.updateMany({
        where: { id: input.id, workspaceId },
        data: {
          unitId: input.unitId ?? current.unitId,
          catalogNumber: input.catalogNumber ?? current.catalogNumber,
          description: input.description !== undefined ? input.description : current.description,
          manufacturerId: manufacturer.id,
          primaryCategoryId,
          secondaryCategoryId,
          defaultLocationId:
            input.defaultLocationId !== undefined
              ? input.defaultLocationId
              : current.defaultLocationId
        }
      });

      if (result.count > 0) {
        await syncPartAttributeValues({ tx, workspaceId, partId: input.id, attributeValueWrites });
        await updatePartValueSortNumber({ tx, workspaceId, partId: input.id, primaryCategoryId });
      }

      return result.count > 0;
    });

    if (!updated) {
      throw new Error("part-not-found");
    }
  } catch (error) {
    throw toPartWriteError(error);
  }

  return { id: input.id };
}

/** Deletes a part; one that stock, orders or builds still refer to is `part-in-use`. */
export async function deletePartForActor(actor: WorkspaceActor, id: string): Promise<{ id: string }> {
  requireActorPermission(actor, "parts:write");

  try {
    const result = await prisma.part.deleteMany({
      where: { id, workspaceId: actor.workspace.id }
    });

    if (result.count === 0) {
      throw new Error("part-not-found");
    }
  } catch (error) {
    throw toPartWriteError(error);
  }

  return { id };
}

function toPartWriteError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return new Error("duplicate-part");
    }

    if (error.code === "P2003") {
      return new Error("part-in-use");
    }
  }

  return error;
}

async function validatePartCategoryAssignment({
  workspaceId,
  primaryCategoryId,
  secondaryCategoryId
}: {
  workspaceId: string;
  primaryCategoryId: string | null;
  secondaryCategoryId: string | null;
}) {
  if (secondaryCategoryId && !primaryCategoryId) {
    throw new Error("secondary-without-primary");
  }

  if (primaryCategoryId && secondaryCategoryId && primaryCategoryId === secondaryCategoryId) {
    throw new Error("duplicate-categories");
  }

  const categoryIds = [primaryCategoryId, secondaryCategoryId].filter(
    (categoryId): categoryId is string => Boolean(categoryId)
  );

  if (categoryIds.length === 0) {
    return;
  }

  const assignableCategories = await prisma.partCategory.findMany({
    where: { id: { in: categoryIds }, workspaceId, isAssignable: true },
    select: { id: true }
  });

  if (assignableCategories.length !== categoryIds.length) {
    throw new Error("invalid-category");
  }
}

async function validatePartUnit({ workspaceId, unitId }: { workspaceId: string; unitId: string }) {
  const unit = await prisma.unit.findFirst({
    where: { id: unitId, workspaceId },
    select: { id: true }
  });

  if (!unit) {
    throw new Error("invalid-unit");
  }
}

async function validateDefaultLocation({
  workspaceId,
  defaultLocationId
}: {
  workspaceId: string;
  defaultLocationId: string | null;
}) {
  if (!defaultLocationId) {
    return;
  }

  const location = await prisma.storageLocation.findFirst({
    where: { id: defaultLocationId, workspaceId, isArchived: false },
    select: { id: true }
  });

  if (!location) {
    throw new Error("invalid-default-location");
  }
}

/**
 * The part's effective attributes: the primary category's plus the secondary category's,
 * deduplicated by attribute id, the primary category's configuration winning.
 */
async function getEffectivePartAttributesForCategories({
  workspaceId,
  primaryCategoryId,
  secondaryCategoryId
}: {
  workspaceId: string;
  primaryCategoryId: string | null;
  secondaryCategoryId: string | null;
}) {
  const [primaryAttributes, secondaryAttributes] = await Promise.all([
    primaryCategoryId
      ? getEffectivePartCategoryAttributes({ workspaceId, categoryId: primaryCategoryId })
      : [],
    secondaryCategoryId
      ? getEffectivePartCategoryAttributes({ workspaceId, categoryId: secondaryCategoryId })
      : []
  ]);
  const primaryAttributeIds = new Set(primaryAttributes.map((attribute) => attribute.attribute.id));

  return [
    ...primaryAttributes,
    ...secondaryAttributes.filter((attribute) => !primaryAttributeIds.has(attribute.attribute.id))
  ];
}

type AttributeValueWrite = {
  attributeId: string;
  data: ReturnType<typeof getPartAttributeValueData> | null;
};

async function getAttributeValueWrites({
  workspaceId,
  primaryCategoryId,
  secondaryCategoryId,
  attributeValues
}: {
  workspaceId: string;
  primaryCategoryId: string | null;
  secondaryCategoryId: string | null;
  attributeValues: PartAttributeValuesInput;
}): Promise<AttributeValueWrite[]> {
  const { values, mode } = attributeValues;

  if (mode === "patch" && values.size === 0) {
    return [];
  }

  const effectiveAttributes = await getEffectivePartAttributesForCategories({
    workspaceId,
    primaryCategoryId,
    secondaryCategoryId
  });

  if (mode === "patch") {
    const effectiveIds = new Set(effectiveAttributes.map((attribute) => attribute.attribute.id));

    if ([...values.keys()].some((attributeId) => !effectiveIds.has(attributeId))) {
      throw new Error("invalid-attribute");
    }
  }

  const targets =
    mode === "form"
      ? effectiveAttributes
      : effectiveAttributes.filter((attribute) => values.has(attribute.attribute.id));

  try {
    return targets.map((effectiveAttribute) => {
      const rawValue = (values.get(effectiveAttribute.attribute.id) ?? "").trim();

      return {
        attributeId: effectiveAttribute.attribute.id,
        data: rawValue ? getPartAttributeValueData({ effectiveAttribute, rawValue }) : null
      };
    });
  } catch {
    throw new Error("invalid-attribute-value");
  }
}

function getPartAttributeValueData({
  effectiveAttribute,
  rawValue
}: {
  effectiveAttribute: EffectiveCategoryAttribute;
  rawValue: string;
}) {
  const emptyValue = {
    textValue: null,
    numberValue: null,
    quantityBaseValue: null,
    booleanValue: null,
    choiceOptionId: null,
    displayValue: null
  };
  const parsedValue = parseAttributeValue({
    type: effectiveAttribute.attribute.type,
    rawValue,
    baseUnitSymbol: effectiveAttribute.attribute.baseUnitSymbol,
    choiceOptions: effectiveAttribute.attribute.choiceOptions
  });

  switch (parsedValue.type) {
    case "TEXT":
      return {
        ...emptyValue,
        textValue: parsedValue.textValue,
        displayValue: parsedValue.displayValue
      };
    case "NUMBER":
      return {
        ...emptyValue,
        numberValue: new Prisma.Decimal(parsedValue.numberValue),
        displayValue: parsedValue.displayValue
      };
    case "QUANTITY":
      return {
        ...emptyValue,
        quantityBaseValue: new Prisma.Decimal(parsedValue.quantityBaseValue),
        displayValue: parsedValue.displayValue
      };
    case "BOOLEAN":
      return {
        ...emptyValue,
        booleanValue: parsedValue.booleanValue,
        displayValue: parsedValue.displayValue
      };
    case "CHOICE":
      return {
        ...emptyValue,
        choiceOptionId: parsedValue.choiceOptionId,
        displayValue: parsedValue.displayValue
      };
  }
}

async function syncPartAttributeValues({
  tx,
  workspaceId,
  partId,
  attributeValueWrites
}: {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  partId: string;
  attributeValueWrites: AttributeValueWrite[];
}) {
  for (const attributeValueWrite of attributeValueWrites) {
    if (!attributeValueWrite.data) {
      await tx.partAttributeValue.deleteMany({
        where: { workspaceId, partId, attributeId: attributeValueWrite.attributeId }
      });
      continue;
    }

    await tx.partAttributeValue.upsert({
      where: {
        partId_attributeId: { partId, attributeId: attributeValueWrite.attributeId }
      },
      create: {
        workspaceId,
        partId,
        attributeId: attributeValueWrite.attributeId,
        ...attributeValueWrite.data
      },
      update: attributeValueWrite.data
    });
  }
}
