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
  getEffectivePartCategoryParameters,
  getPartParameterValuesOutsidePrimaryCategory,
  type EffectiveCategoryParameter
} from "@/server/parts/parameters";
import { parseParameterValue } from "@/server/parts/parameterValues";

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

export async function createPart(
  formData: FormData
): Promise<PartMutationResult> {
  const workspaceSlug = getRequiredFormValue(formData, "workspaceSlug");
  const catalogNumber = getRequiredFormValue(formData, "catalogNumber");
  const manufacturerName = getRequiredFormValue(formData, "manufacturerName");
  const primaryCategoryId = getOptionalFormValue(formData, "primaryCategoryId");
  const secondaryCategoryId = getOptionalFormValue(
    formData,
    "secondaryCategoryId"
  );
  const submittedParameterValues = getSubmittedParameterValues(formData);
  const partsPath = getPartsPath(workspaceSlug);
  let part: PartsListItem | null = null;

  if (!workspaceSlug || !catalogNumber || !manufacturerName) {
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
        const effectiveParameters = primaryCategoryId
          ? await getEffectivePartCategoryParameters({
              workspaceId: context.workspace.id,
              categoryId: primaryCategoryId
            })
          : [];
        const parameterValueWrites = tryGetPartParameterValueWrites({
          effectiveParameters,
          submittedValues: submittedParameterValues
        });

        if (!parameterValueWrites) {
          formError = "invalid-parameter-value";
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
                  catalogNumber,
                  manufacturerId: manufacturer.id,
                  primaryCategoryId,
                  secondaryCategoryId
                },
                select: {
                  id: true
                }
              });

              await syncPartParameterValues({
                tx,
                workspaceId: context.workspace.id,
                partId: nextPart.id,
                effectiveParameterIds: effectiveParameters.map(
                  (effectiveParameter) => effectiveParameter.parameter.id
                ),
                parameterValueWrites
              });

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
  const catalogNumber = getRequiredFormValue(formData, "catalogNumber");
  const manufacturerName = getRequiredFormValue(formData, "manufacturerName");
  const primaryCategoryId = getOptionalFormValue(formData, "primaryCategoryId");
  const secondaryCategoryId = getOptionalFormValue(
    formData,
    "secondaryCategoryId"
  );
  const submittedParameterValues = getSubmittedParameterValues(formData);
  const confirmedParameterValueRemoval =
    getRequiredFormValue(formData, "confirmParameterValueRemoval") === "yes";
  const partsPath = getPartsPath(workspaceSlug);
  let part: PartsListItem | null = null;

  if (!workspaceSlug || !id || !catalogNumber || !manufacturerName) {
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
        const outsideValues = await getPartParameterValuesOutsidePrimaryCategory({
          workspaceId: context.workspace.id,
          partId: id,
          primaryCategoryId
        });

        if (outsideValues.length > 0 && !confirmedParameterValueRemoval) {
          formError = "confirm-parameter-value-removal";
        }
      }

      if (!formError) {
        const effectiveParameters = primaryCategoryId
          ? await getEffectivePartCategoryParameters({
              workspaceId: context.workspace.id,
              categoryId: primaryCategoryId
            })
          : [];
        const effectiveParameterIds = effectiveParameters.map(
          (effectiveParameter) => effectiveParameter.parameter.id
        );
        const parameterValueWrites = tryGetPartParameterValueWrites({
          effectiveParameters,
          submittedValues: submittedParameterValues
        });

        if (!parameterValueWrites) {
          formError = "invalid-parameter-value";
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
                  catalogNumber,
                  manufacturerId: manufacturer.id,
                  primaryCategoryId,
                  secondaryCategoryId
                }
              });

              if (nextUpdateResult.count > 0) {
                await syncPartParameterValues({
                  tx,
                  workspaceId: context.workspace.id,
                  partId: id,
                  effectiveParameterIds,
                  parameterValueWrites
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

function getSubmittedParameterValues(formData: FormData) {
  const submittedValues = new Map<string, string>();

  for (const [name, value] of formData.entries()) {
    if (!name.startsWith("parameterValue:") || typeof value !== "string") {
      continue;
    }

    submittedValues.set(name.slice("parameterValue:".length), value.trim());
  }

  return submittedValues;
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

function getPartWriteError(error: unknown) {
  if (error instanceof Error && error.message === "invalid_parameter_value") {
    return "invalid-parameter-value";
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

function tryGetPartParameterValueWrites({
  effectiveParameters,
  submittedValues
}: {
  effectiveParameters: EffectiveCategoryParameter[];
  submittedValues: Map<string, string>;
}) {
  try {
    return effectiveParameters.map((effectiveParameter) => {
      const rawValue = submittedValues.get(effectiveParameter.parameter.id) ?? "";

      if (!rawValue) {
        return {
          parameterId: effectiveParameter.parameter.id,
          data: null
        };
      }
      return {
        parameterId: effectiveParameter.parameter.id,
        data: getPartParameterValueData({
          effectiveParameter,
          rawValue
        })
      };
    });
  } catch {
    return null;
  }
}

function getPartParameterValueData({
  effectiveParameter,
  rawValue
}: {
  effectiveParameter: EffectiveCategoryParameter;
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
  const parsedValue = parseParameterValue({
    type: effectiveParameter.parameter.type,
    rawValue,
    baseUnitSymbol: effectiveParameter.parameter.baseUnitSymbol,
    choiceOptions: effectiveParameter.parameter.choiceOptions
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

async function syncPartParameterValues({
  tx,
  workspaceId,
  partId,
  effectiveParameterIds,
  parameterValueWrites
}: {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  partId: string;
  effectiveParameterIds: string[];
  parameterValueWrites: Array<{
    parameterId: string;
    data: ReturnType<typeof getPartParameterValueData> | null;
  }>;
}) {
  await tx.partParameterValue.deleteMany({
    where: {
      workspaceId,
      partId,
      parameterId: {
        notIn: effectiveParameterIds
      }
    }
  });

  for (const parameterValueWrite of parameterValueWrites) {
    if (!parameterValueWrite.data) {
      await tx.partParameterValue.deleteMany({
        where: {
          workspaceId,
          partId,
          parameterId: parameterValueWrite.parameterId
        }
      });
      continue;
    }

    await tx.partParameterValue.upsert({
      where: {
        partId_parameterId: {
          partId,
          parameterId: parameterValueWrite.parameterId
        }
      },
      create: {
        workspaceId,
        partId,
        parameterId: parameterValueWrite.parameterId,
        ...parameterValueWrite.data
      },
      update: parameterValueWrite.data
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
        catalogNumber: true,
        manufacturer: {
          select: {
            name: true
          }
        },
        primaryCategoryId: true,
        secondaryCategoryId: true,
        parameterValues: {
          orderBy: [{ parameter: { name: "asc" } }, { id: "asc" }],
          select: {
            parameterId: true,
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
  const primaryParameterId = part.primaryCategoryId
    ? (
        await getEffectivePartCategoryParameters({
          workspaceId,
          categoryId: part.primaryCategoryId
        })
      ).find((effectiveParameter) => effectiveParameter.isPrimary)?.parameter.id ??
      null
    : null;
  const parameterValues = part.parameterValues
    .filter((parameterValue) => parameterValue.displayValue !== null)
    .map((parameterValue) => ({
      parameterId: parameterValue.parameterId,
      displayValue: parameterValue.displayValue ?? ""
    }));

  return {
    id: part.id,
    catalogNumber: part.catalogNumber,
    manufacturerName: part.manufacturer.name,
    valueDisplayValue: primaryParameterId
      ? parameterValues.find(
          (parameterValue) => parameterValue.parameterId === primaryParameterId
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
    parameterValues
  };
}
