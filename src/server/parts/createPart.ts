"use server";

import { revalidatePath } from "next/cache";

import { Prisma } from "@/generated/prisma/client";
import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import { prisma } from "@/server/db/prisma";
import {
  ensureOrganizationWithRole,
  ORGANIZATION_ROLE_MANUFACTURER
} from "@/server/organizations/organizations";
import { getPartCategories } from "@/server/parts/categories";
import type { PartsListItem } from "@/server/parts/getParts";
import {
  getEffectivePartCategoryAttributes,
  type EffectiveCategoryAttribute
} from "@/server/parts/attributes";
import { parseAttributeValue } from "@/server/parts/attributeValues";
import { learnSupplierMatching } from "@/server/integrations/matching";
import type { SupplierProviderKey } from "@/server/integrations/types";

export type PartMutationResult =
  | {
      ok: true;
      part: PartsListItem;
      submittedAt: number;
    }
  | {
      ok: false;
      error: string;
      submittedAt: number;
    };

export type PartDeleteResult =
  | {
      ok: true;
      id: string;
      submittedAt: number;
    }
  | {
      ok: false;
      error: string;
      submittedAt: number;
    };

export async function createPart(
  formData: FormData
): Promise<PartMutationResult> {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const unitId = getRequiredFormValue(formData, "unitId");
  const catalogNumber = getRequiredFormValue(formData, "catalogNumber");
  const description = getOptionalFormValue(formData, "description");
  const manufacturerName = getRequiredFormValue(formData, "manufacturerName");
  const primaryCategoryId = getOptionalFormValue(formData, "primaryCategoryId");
  const secondaryCategoryId = getOptionalFormValue(
    formData,
    "secondaryCategoryId"
  );
  const submittedAttributeValues = getSubmittedAttributeValues(formData);
  const supplierMatchingPayload = getSupplierMatchingPayload(formData);
  const partsPath = getPartsPath(workspaceSlug);
  let part: PartsListItem | null = null;

  if (!workspaceSlug || !unitId || !catalogNumber || !manufacturerName) {
    return getFormErrorState("missing-required-fields");
  }

  let formError: string | null = null;

  try {
    const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

    if (!context) {
      formError = "database-unavailable";
    } else {
      await authorizeWorkspacePermission({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        permission: "parts:write"
      });

      formError = await validatePartCategoryAssignment({
        workspaceId: context.workspace.id,
        primaryCategoryId,
        secondaryCategoryId
      });

      if (!formError) {
        formError = await validatePartUnit({
          workspaceId: context.workspace.id,
          unitId
        });
      }

      if (!formError) {
        const effectiveAttributes = await getEffectivePartAttributesForCategories({
          workspaceId: context.workspace.id,
          primaryCategoryId,
          secondaryCategoryId
        });
        const attributeValueWrites = tryGetPartAttributeValueWrites({
          effectiveAttributes,
          submittedValues: submittedAttributeValues
        });

        if (!attributeValueWrites) {
          formError = "invalid-attribute-value";
        } else {
          const manufacturer = await ensureOrganizationWithRole({
            workspaceId: context.workspace.id,
            name: manufacturerName,
            role: ORGANIZATION_ROLE_MANUFACTURER
          });

          try {
            const createdPart = await prisma.$transaction(async (tx) => {
              const nextPart = await tx.part.create({
                data: {
                  workspaceId: context.workspace.id,
                  unitId,
                  catalogNumber,
                  description,
                  manufacturerId: manufacturer.id,
                  primaryCategoryId,
                  secondaryCategoryId
                },
                select: {
                  id: true
                }
              });

              await syncPartAttributeValues({
                tx,
                workspaceId: context.workspace.id,
                partId: nextPart.id,
                attributeValueWrites
              });

              if (supplierMatchingPayload?.mode === "create-from-suggestion") {
                await learnSupplierMatching({
                  tx,
                  workspaceId: context.workspace.id,
                  provider: supplierMatchingPayload.provider,
                  sourceCategoryKey: supplierMatchingPayload.sourceCategoryKey,
                  targetCategoryId: supplierMatchingPayload.targetCategoryId,
                  attributeMappings: supplierMatchingPayload.attributeMappings,
                  sourceManufacturerKey:
                    supplierMatchingPayload.sourceManufacturerKey,
                  targetManufacturerId: manufacturer.id
                });
              }

              return nextPart;
            });
            part = await getPartListItem({
              id: createdPart.id,
              workspaceId: context.workspace.id
            });
          } catch (error) {
            formError = getPartWriteError(error);
          }
        }
      }
    }
  } catch {
    formError = "database-unavailable";
  }

  if (formError) {
    return getFormErrorState(formError);
  }

  if (!part) {
    return getFormErrorState("database-unavailable");
  }

  revalidatePath(partsPath);
  return getFormSuccessState(part);
}

export async function updatePart(
  formData: FormData
): Promise<PartMutationResult> {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const id = getRequiredFormValue(formData, "id");
  const unitId = getRequiredFormValue(formData, "unitId");
  const catalogNumber = getRequiredFormValue(formData, "catalogNumber");
  const description = getOptionalFormValue(formData, "description");
  const manufacturerName = getRequiredFormValue(formData, "manufacturerName");
  const primaryCategoryId = getOptionalFormValue(formData, "primaryCategoryId");
  const secondaryCategoryId = getOptionalFormValue(
    formData,
    "secondaryCategoryId"
  );
  const submittedAttributeValues = getSubmittedAttributeValues(formData);
  const partsPath = getPartsPath(workspaceSlug);
  let part: PartsListItem | null = null;

  if (!workspaceSlug || !id || !unitId || !catalogNumber || !manufacturerName) {
    return getFormErrorState("missing-required-fields");
  }

  let formError: string | null = null;

  try {
    const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

    if (!context) {
      formError = "database-unavailable";
    } else {
      await authorizeWorkspacePermission({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        permission: "parts:write"
      });

      formError = await validatePartCategoryAssignment({
        workspaceId: context.workspace.id,
        primaryCategoryId,
        secondaryCategoryId
      });

      if (!formError) {
        formError = await validatePartUnit({
          workspaceId: context.workspace.id,
          unitId
        });
      }

      if (!formError) {
        const effectiveAttributes = await getEffectivePartAttributesForCategories({
          workspaceId: context.workspace.id,
          primaryCategoryId,
          secondaryCategoryId
        });
        const attributeValueWrites = tryGetPartAttributeValueWrites({
          effectiveAttributes,
          submittedValues: submittedAttributeValues
        });

        if (!attributeValueWrites) {
          formError = "invalid-attribute-value";
        } else {
          const manufacturer = await ensureOrganizationWithRole({
            workspaceId: context.workspace.id,
            name: manufacturerName,
            role: ORGANIZATION_ROLE_MANUFACTURER
          });

          try {
            const updateResult = await prisma.$transaction(async (tx) => {
              const nextUpdateResult = await tx.part.updateMany({
                where: {
                  id,
                  workspaceId: context.workspace.id
                },
                data: {
                  unitId,
                  catalogNumber,
                  description,
                  manufacturerId: manufacturer.id,
                  primaryCategoryId,
                  secondaryCategoryId
                }
              });

              if (nextUpdateResult.count > 0) {
                await syncPartAttributeValues({
                  tx,
                  workspaceId: context.workspace.id,
                  partId: id,
                  attributeValueWrites
                });
              }

              return nextUpdateResult;
            });

            if (updateResult.count === 0) {
              formError = "database-unavailable";
            } else {
              part = await getPartListItem({
                id,
                workspaceId: context.workspace.id
              });
            }
          } catch (error) {
            formError = getPartWriteError(error);
          }
        }
      }
    }
  } catch {
    formError = "database-unavailable";
  }

  if (formError) {
    return getFormErrorState(formError);
  }

  if (!part) {
    return getFormErrorState("database-unavailable");
  }

  revalidatePath(partsPath);
  return getFormSuccessState(part);
}

export async function deletePart(formData: FormData): Promise<PartDeleteResult> {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const id = getRequiredFormValue(formData, "id");
  const partsPath = getPartsPath(workspaceSlug);

  if (!workspaceSlug || !id) {
    return getDeleteErrorState("missing-required-fields");
  }

  let formError: string | null = null;

  try {
    const context = await getCurrentWorkspaceContextBySlug(workspaceSlug);

    if (!context) {
      formError = "database-unavailable";
    } else {
      await authorizeWorkspacePermission({
        userId: context.user.id,
        workspaceId: context.workspace.id,
        permission: "parts:write"
      });

      const deleteResult = await prisma.part.deleteMany({
        where: {
          id,
          workspaceId: context.workspace.id
        }
      });

      if (deleteResult.count === 0) {
        formError = "part-not-found";
      }
    }
  } catch {
    formError = "database-unavailable";
  }

  if (formError) {
    return getDeleteErrorState(formError);
  }

  revalidatePath(partsPath);
  return {
    ok: true,
    id,
    submittedAt: Date.now()
  };
}

function getRequiredFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  if (typeof value !== "string") {
    return "";
  }

  return value.trim();
}

function getOptionalFormValue(formData: FormData, name: string) {
  const value = getRequiredFormValue(formData, name);

  return value || null;
}

function getSubmittedAttributeValues(formData: FormData) {
  const submittedValues = new Map<string, string>();

  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("attributeValue:") || typeof value !== "string") {
      continue;
    }

    submittedValues.set(name.slice("attributeValue:".length), value.trim());
  }

  return submittedValues;
}

type SupplierMatchingPayload = {
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

function getSupplierMatchingPayload(
  formData: FormData
): SupplierMatchingPayload | null {
  const rawPayload = formData.get("supplierMatchingPayload");

  if (typeof rawPayload !== "string" || !rawPayload.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawPayload) as Partial<SupplierMatchingPayload>;

    if (
      parsed.mode !== "create-from-suggestion" ||
      !isSupplierProviderKey(parsed.provider) ||
      typeof parsed.sourceCategoryKey !== "string" ||
      typeof parsed.sourceManufacturerKey !== "string" ||
      !Array.isArray(parsed.attributeMappings)
    ) {
      return null;
    }

    const targetCategoryId =
      typeof parsed.targetCategoryId === "string" && parsed.targetCategoryId
        ? parsed.targetCategoryId
        : null;
    const attributeMappings = parsed.attributeMappings
      .filter(
        (item): item is { sourceAttributeKey: string; targetAttributeId: string } =>
          typeof item?.sourceAttributeKey === "string" &&
          item.sourceAttributeKey.length > 0 &&
          typeof item?.targetAttributeId === "string" &&
          item.targetAttributeId.length > 0
      )
      .map((item) => ({
        sourceAttributeKey: item.sourceAttributeKey,
        targetAttributeId: item.targetAttributeId
      }));

    return {
      mode: "create-from-suggestion",
      provider: parsed.provider,
      sourceCategoryKey: parsed.sourceCategoryKey,
      sourceManufacturerKey: parsed.sourceManufacturerKey,
      targetCategoryId,
      attributeMappings
    };
  } catch {
    return null;
  }
}

function isSupplierProviderKey(value: unknown): value is SupplierProviderKey {
  return value === "digikey" || value === "mouser" || value === "tme";
}

function getPartsPath(workspaceSlug: string) {
  if (!workspaceSlug) {
    return "/workspaces";
  }

  return `/w/${encodeURIComponent(workspaceSlug)}/parts`;
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
    return "secondary-without-primary";
  }

  if (
    primaryCategoryId &&
    secondaryCategoryId &&
    primaryCategoryId === secondaryCategoryId
  ) {
    return "duplicate-categories";
  }

  const categoryIds = [primaryCategoryId, secondaryCategoryId].filter(
    (categoryId): categoryId is string => Boolean(categoryId)
  );

  if (categoryIds.length === 0) {
    return null;
  }

  const assignableCategories = await prisma.partCategory.findMany({
    where: {
      id: {
        in: categoryIds
      },
      workspaceId,
      isAssignable: true
    },
    select: {
      id: true
    }
  });

  if (assignableCategories.length !== categoryIds.length) {
    return "invalid-category";
  }

  return null;
}

async function validatePartUnit({
  workspaceId,
  unitId
}: {
  workspaceId: string;
  unitId: string | null;
}) {
  if (!unitId) {
    return "missing-required-fields";
  }

  const unit = await prisma.unit.findFirst({
    where: {
      id: unitId,
      workspaceId
    },
    select: {
      id: true
    }
  });

  if (!unit) {
    return "invalid-unit";
  }

  return null;
}

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
      ? getEffectivePartCategoryAttributes({
          workspaceId,
          categoryId: primaryCategoryId
        })
      : [],
    secondaryCategoryId
      ? getEffectivePartCategoryAttributes({
          workspaceId,
          categoryId: secondaryCategoryId
        })
      : []
  ]);
  const primaryAttributeIds = new Set(
    primaryAttributes.map((attribute) => attribute.attribute.id)
  );

  return [
    ...primaryAttributes,
    ...secondaryAttributes.filter(
      (attribute) => !primaryAttributeIds.has(attribute.attribute.id)
    )
  ];
}

function getPartWriteError(error: unknown) {
  if (error instanceof Error && error.message === "invalid-attribute-value") {
    return "invalid-attribute-value";
  }

  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "duplicate-part";
  }

  return "database-unavailable";
}

function getFormSuccessState(part: PartsListItem): PartMutationResult {
  return {
    ok: true,
    part,
    submittedAt: Date.now()
  };
}

function getFormErrorState(error: string): PartMutationResult {
  return {
    ok: false,
    error,
    submittedAt: Date.now()
  };
}

function getDeleteErrorState(error: string): PartDeleteResult {
  return {
    ok: false,
    error,
    submittedAt: Date.now()
  };
}

function tryGetPartAttributeValueWrites({
  effectiveAttributes,
  submittedValues
}: {
  effectiveAttributes: EffectiveCategoryAttribute[];
  submittedValues: Map<string, string>;
}) {
  try {
    return effectiveAttributes.map((effectiveAttribute) => {
      const rawValue = submittedValues.get(effectiveAttribute.attribute.id) ?? "";

      if (!rawValue) {
        return {
          attributeId: effectiveAttribute.attribute.id,
          data: null
        };
      }
      return {
        attributeId: effectiveAttribute.attribute.id,
        data: getPartAttributeValueData({
          effectiveAttribute,
          rawValue
        })
      };
    });
  } catch {
    return null;
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
  attributeValueWrites: Array<{
    attributeId: string;
    data: ReturnType<typeof getPartAttributeValueData> | null;
  }>;
}) {
  for (const attributeValueWrite of attributeValueWrites) {
    if (!attributeValueWrite.data) {
      await tx.partAttributeValue.deleteMany({
        where: {
          workspaceId,
          partId,
          attributeId: attributeValueWrite.attributeId
        }
      });
      continue;
    }

    await tx.partAttributeValue.upsert({
      where: {
        partId_attributeId: {
          partId,
          attributeId: attributeValueWrite.attributeId
        }
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

async function getPartListItem({
  id,
  workspaceId
}: {
  id: string;
  workspaceId: string;
}) {
  const [part, categories] = await Promise.all([
    prisma.part.findFirst({
      where: {
        id,
        workspaceId
      },
      select: {
        id: true,
        unitId: true,
        currentStock: true,
        plannedQty: true,
        onOrderQty: true,
        catalogNumber: true,
        description: true,
        manufacturer: {
          select: {
            name: true
          }
        },
        primaryCategoryId: true,
        secondaryCategoryId: true,
        attributeValues: {
          orderBy: [{ attribute: { name: "asc" } }, { id: "asc" }],
          select: {
            attributeId: true,
            displayValue: true
          }
        }
      }
    }),
    getPartCategories(workspaceId)
  ]);

  if (!part) {
    return null;
  }

  const categoryPathsById = new Map(
    categories.map((category) => [category.id, category.path])
  );
  const valueAttributeId = part.primaryCategoryId
    ? (
        await getEffectivePartCategoryAttributes({
          workspaceId,
          categoryId: part.primaryCategoryId
        })
      ).find((effectiveAttribute) => effectiveAttribute.isValue)?.attribute.id ??
      null
    : null;
  const attributeValues = part.attributeValues
    .filter((attributeValue) => attributeValue.displayValue !== null)
    .map((attributeValue) => ({
      attributeId: attributeValue.attributeId,
      displayValue: attributeValue.displayValue ?? ""
    }));

  return {
    id: part.id,
    unitId: part.unitId,
    catalogNumber: part.catalogNumber,
    description: part.description,
    manufacturerName: part.manufacturer.name,
    valueDisplayValue: valueAttributeId
      ? attributeValues.find(
          (attributeValue) => attributeValue.attributeId === valueAttributeId
        )?.displayValue ?? null
      : null,
    primaryCategoryId: part.primaryCategoryId,
    primaryCategoryPath: part.primaryCategoryId
      ? categoryPathsById.get(part.primaryCategoryId) ?? null
      : null,
    secondaryCategoryId: part.secondaryCategoryId,
    secondaryCategoryPath: part.secondaryCategoryId
      ? categoryPathsById.get(part.secondaryCategoryId) ?? null
      : null,
    currentStock: part.currentStock.toString(),
    plannedQuantity: part.plannedQty.toString(),
    onOrderQuantity: part.onOrderQty.toString(),
    attributeValues
  };
}
