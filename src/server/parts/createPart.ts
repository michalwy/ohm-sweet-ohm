"use server";


import { resolveWorkspaceActor } from "@/server/auth/currentActor";
import { prisma } from "@/server/db/prisma";
import { getPartCategories } from "@/server/parts/categories";
import type { PartsListItem } from "@/server/parts/getParts";
import { getEffectivePartCategoryAttributes } from "@/server/parts/attributes";
import {
  createPartForActor,
  deletePartForActor,
  updatePartForActor,
  type PartFields,
  type SupplierMatchingPayload
} from "@/server/parts/partMutations";
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
  const fields = getPartFormFields(formData);

  if (!workspaceSlug || !fields) {
    return getFormErrorState("missing-required-fields");
  }

  try {
    const context = await resolveWorkspaceActor({ kind: "session", workspaceSlug });

    if (!context) {
      return getFormErrorState("database-unavailable");
    }

    const { id } = await createPartForActor(context, {
      ...fields,
      attributeValues: { values: getSubmittedAttributeValues(formData), mode: "form" },
      supplierMatching: getSupplierMatchingPayload(formData)
    });

    return await getPartResult(id, context.workspace.id);
  } catch (error) {
    return getFormErrorState(getPartFormError(error));
  }
}

export async function updatePart(
  formData: FormData
): Promise<PartMutationResult> {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const id = getRequiredFormValue(formData, "id");
  const fields = getPartFormFields(formData);

  if (!workspaceSlug || !id || !fields) {
    return getFormErrorState("missing-required-fields");
  }

  try {
    const context = await resolveWorkspaceActor({ kind: "session", workspaceSlug });

    if (!context) {
      return getFormErrorState("database-unavailable");
    }

    await updatePartForActor(context, {
      id,
      ...fields,
      attributeValues: { values: getSubmittedAttributeValues(formData), mode: "form" }
    });

    return await getPartResult(id, context.workspace.id);
  } catch (error) {
    return getFormErrorState(getPartFormError(error));
  }
}

export async function deletePart(formData: FormData): Promise<PartDeleteResult> {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const id = getRequiredFormValue(formData, "id");

  if (!workspaceSlug || !id) {
    return getDeleteErrorState("missing-required-fields");
  }

  try {
    const context = await resolveWorkspaceActor({ kind: "session", workspaceSlug });

    if (!context) {
      return getDeleteErrorState("database-unavailable");
    }

    await deletePartForActor(context, id);
  } catch (error) {
    return getDeleteErrorState(getPartFormError(error));
  }

  return {
    ok: true,
    id,
    submittedAt: Date.now()
  };
}

/** The part dialog's fields, or null when a required one is missing. */
function getPartFormFields(formData: FormData): PartFields | null {
  const unitId = getRequiredFormValue(formData, "unitId");
  const catalogNumber = getRequiredFormValue(formData, "catalogNumber");
  const manufacturerName = getRequiredFormValue(formData, "manufacturerName");

  if (!unitId || !catalogNumber || !manufacturerName) {
    return null;
  }

  return {
    unitId,
    catalogNumber,
    description: getOptionalFormValue(formData, "description"),
    manufacturerName,
    primaryCategoryId: getOptionalFormValue(formData, "primaryCategoryId"),
    secondaryCategoryId: getOptionalFormValue(formData, "secondaryCategoryId"),
    defaultLocationId: getOptionalFormValue(formData, "defaultLocationId")
  };
}

/** A domain error code as the dialog shows it; anything unexpected is "database-unavailable". */
function getPartFormError(error: unknown) {
  if (error instanceof Error && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(error.message)) {
    return error.message;
  }

  return "database-unavailable";
}

async function getPartResult(id: string, workspaceId: string) {
  const part = await getPartListItem({ id, workspaceId });

  return part ? getFormSuccessState(part) : getFormErrorState("database-unavailable");
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
        reservedQty: true,
        allocatedQty: true,
        plannedQty: true,
        onOrderQty: true,
        inProductionQty: true,
        catalogNumber: true,
        description: true,
        manufacturer: {
          select: {
            name: true,
            isInternal: true
          }
        },
        assembledByDesign: {
          select: { id: true }
        },
        primaryCategoryId: true,
        secondaryCategoryId: true,
        defaultLocation: {
          select: {
            id: true,
            name: true
          }
        },
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
    isAssembled: part.assembledByDesign !== null,
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
    defaultLocationId: part.defaultLocation?.id ?? null,
    defaultLocationName: part.defaultLocation?.name ?? null,
    currentStock: part.currentStock.toString(),
    reservedQuantity: part.reservedQty.toString(),
    allocatedQuantity: part.allocatedQty.toString(),
    availableQuantity: part.currentStock.minus(part.reservedQty).toString(),
    balanceQuantity: part.currentStock
      .minus(part.reservedQty)
      .plus(part.onOrderQty)
      .plus(part.inProductionQty)
      .minus(part.allocatedQty)
      .toString(),
    plannedQuantity: part.plannedQty.toString(),
    onOrderQuantity: part.onOrderQty.toString(),
    inProductionQuantity: part.inProductionQty.toString(),
    avgNetCost: null,
    avgGrossCost: null,
    attributeValues
  };
}
