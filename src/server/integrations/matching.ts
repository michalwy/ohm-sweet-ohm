"use server";

import type { Prisma } from "@/generated/prisma/client";
import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import { prisma } from "@/server/db/prisma";
import type { SupplierProviderKey } from "@/server/integrations/types";

const UNCATEGORIZED_SOURCE_KEY = "uncategorized";
const NO_TARGET_CATEGORY_SCOPE_KEY = "__none__";

export type SupplierAttributeDraft = {
  sourceAttribute: string;
  sourceAttributeName: string;
  sourceUnit: string | null;
  sourceAttributeKey: string;
  sourceValue: string;
  suggestedTargetAttributeId: string | null;
};

export async function getSupplierMatchingSuggestionsForWorkspace(input: {
  workspaceSlug: string;
  provider: SupplierProviderKey;
  sourceManufacturerName?: string | null;
  sourceCategory: string | null;
  sourceAttributes: Array<{
    sourceAttribute: string;
    sourceValue: string;
    sourceUnit?: string | null;
  }>;
  targetCategoryId: string | null;
}) {
  const context = await getCurrentWorkspaceContextBySlug(input.workspaceSlug);

  if (!context) {
    return { ok: false as const, error: "database-unavailable" };
  }

  await authorizeWorkspacePermission({
    userId: context.user.id,
    workspaceId: context.workspace.id,
    permission: "parts:write"
  });

  const sourceCategoryKey = normalizeSourceCategoryKey(input.sourceCategory);
  const targetCategoryScopeKey = getTargetCategoryScopeKey(input.targetCategoryId);

  const sourceManufacturerKey = normalizeSourceManufacturerKey(
    input.sourceManufacturerName
  );

  const [categoryCandidates, attributeCandidates, manufacturerCandidates] =
    await Promise.all([
    prisma.supplierCategoryMappingStat.findMany({
      where: {
        workspaceId: context.workspace.id,
        provider: input.provider,
        sourceCategoryKey
      },
      orderBy: [{ score: "desc" }, { lastUsedAt: "desc" }, { createdAt: "desc" }],
      select: {
        targetCategoryId: true,
        score: true,
        lastUsedAt: true
      }
    }),
    prisma.supplierAttributeMappingStat.findMany({
      where: {
        workspaceId: context.workspace.id,
        provider: input.provider,
        sourceCategoryKey,
        targetCategoryScopeKey
      },
      orderBy: [{ score: "desc" }, { lastUsedAt: "desc" }, { createdAt: "desc" }],
      select: {
        sourceAttributeKey: true,
        targetAttributeId: true,
        score: true,
        lastUsedAt: true
      }
    }),
    prisma.supplierManufacturerMappingStat.findMany({
      where: {
        workspaceId: context.workspace.id,
        provider: input.provider,
        sourceManufacturerKey
      },
      orderBy: [{ score: "desc" }, { lastUsedAt: "desc" }, { createdAt: "desc" }],
      select: {
        targetManufacturer: {
          select: {
            name: true
          }
        }
      }
    })
  ]);

  const bestTargetCategoryId = categoryCandidates[0]?.targetCategoryId ?? null;
  const bestTargetBySourceAttribute = new Map<string, string>();

  for (const candidate of attributeCandidates) {
    if (!bestTargetBySourceAttribute.has(candidate.sourceAttributeKey)) {
      bestTargetBySourceAttribute.set(
        candidate.sourceAttributeKey,
        candidate.targetAttributeId
      );
    }
  }

  const rows: SupplierAttributeDraft[] = input.sourceAttributes
    .map((item) => {
      const sourceValue = normalizeSourceValue(item.sourceValue);
      if (!sourceValue) {
        return null;
      }

      const sourceAttributeKey = buildSourceAttributeKey({
        name: item.sourceAttribute,
        unit: item.sourceUnit ?? null
      });

      return {
        sourceAttribute: formatSourceAttributeDisplay({
          name: item.sourceAttribute,
          unit: item.sourceUnit ?? null
        }),
        sourceAttributeName: item.sourceAttribute,
        sourceUnit: item.sourceUnit ?? null,
        sourceAttributeKey,
        sourceValue,
        suggestedTargetAttributeId:
          bestTargetBySourceAttribute.get(sourceAttributeKey) ?? null
      };
    })
    .filter((item): item is SupplierAttributeDraft => item !== null);

  return {
    ok: true as const,
    payload: {
      sourceCategoryKey,
      sourceManufacturerKey,
      suggestedTargetCategoryId: bestTargetCategoryId,
      suggestedTargetManufacturerName:
        manufacturerCandidates[0]?.targetManufacturer.name ?? null,
      attributeRows: rows
    }
  };
}

export async function learnSupplierMatching(input: {
  tx: Prisma.TransactionClient;
  workspaceId: string;
  provider: SupplierProviderKey;
  sourceCategoryKey: string;
  targetCategoryId: string | null;
  attributeMappings: Array<{
    sourceAttributeKey: string;
    targetAttributeId: string;
  }>;
  sourceManufacturerKey: string;
  targetManufacturerId: string | null;
}) {
  const now = new Date();

  if (input.targetCategoryId) {
    await input.tx.supplierCategoryMappingStat.upsert({
      where: {
        workspaceId_provider_sourceCategoryKey_targetCategoryId: {
          workspaceId: input.workspaceId,
          provider: input.provider,
          sourceCategoryKey: input.sourceCategoryKey,
          targetCategoryId: input.targetCategoryId
        }
      },
      create: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        sourceCategoryKey: input.sourceCategoryKey,
        targetCategoryId: input.targetCategoryId,
        score: 1,
        lastUsedAt: now
      },
      update: {
        score: { increment: 1 },
        lastUsedAt: now
      }
    });
  }

  const targetCategoryScopeKey = getTargetCategoryScopeKey(input.targetCategoryId);
  const uniqueMappings = new Map<string, { sourceAttributeKey: string; targetAttributeId: string }>();

  for (const mapping of input.attributeMappings) {
    if (!mapping.sourceAttributeKey || !mapping.targetAttributeId) {
      continue;
    }

    uniqueMappings.set(
      `${mapping.sourceAttributeKey}::${mapping.targetAttributeId}`,
      mapping
    );
  }

  for (const mapping of uniqueMappings.values()) {
    await input.tx.supplierAttributeMappingStat.upsert({
      where: {
        workspaceId_provider_sourceCategoryKey_targetCategoryScopeKey_sourceAttributeKey_targetAttributeId:
          {
            workspaceId: input.workspaceId,
            provider: input.provider,
            sourceCategoryKey: input.sourceCategoryKey,
            targetCategoryScopeKey,
            sourceAttributeKey: mapping.sourceAttributeKey,
            targetAttributeId: mapping.targetAttributeId
          }
      },
      create: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        sourceCategoryKey: input.sourceCategoryKey,
        targetCategoryScopeKey,
        sourceAttributeKey: mapping.sourceAttributeKey,
        targetAttributeId: mapping.targetAttributeId,
        score: 1,
        lastUsedAt: now
      },
      update: {
        score: { increment: 1 },
        lastUsedAt: now
      }
    });
  }

  if (input.targetManufacturerId) {
    await input.tx.supplierManufacturerMappingStat.upsert({
      where: {
        workspaceId_provider_sourceManufacturerKey_targetManufacturerId: {
          workspaceId: input.workspaceId,
          provider: input.provider,
          sourceManufacturerKey: input.sourceManufacturerKey,
          targetManufacturerId: input.targetManufacturerId
        }
      },
      create: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        sourceManufacturerKey: input.sourceManufacturerKey,
        targetManufacturerId: input.targetManufacturerId,
        score: 1,
        lastUsedAt: now
      },
      update: {
        score: { increment: 1 },
        lastUsedAt: now
      }
    });
  }
}

function normalizeSourceCategoryKey(sourceCategory: string | null | undefined) {
  if (!sourceCategory) {
    return UNCATEGORIZED_SOURCE_KEY;
  }

  const normalized = normalizeKey(sourceCategory);
  return normalized || UNCATEGORIZED_SOURCE_KEY;
}

function normalizeSourceManufacturerKey(
  sourceManufacturerName: string | null | undefined
) {
  if (!sourceManufacturerName) {
    return UNCATEGORIZED_SOURCE_KEY;
  }

  const normalized = normalizeKey(sourceManufacturerName);
  return normalized || UNCATEGORIZED_SOURCE_KEY;
}

function buildSourceAttributeKey(input: {
  name: string;
  unit?: string | null;
}) {
  const nameKey = normalizeKey(input.name);
  const unitKey = normalizeKey(input.unit ?? "");

  return `${nameKey}::${unitKey}`;
}

function normalizeSourceValue(value: string) {
  return value.trim();
}

function formatSourceAttributeDisplay(input: { name: string; unit?: string | null }) {
  const name = input.name.trim();
  const unit = (input.unit ?? "").trim();

  return unit ? `${name} (${unit})` : name;
}

function getTargetCategoryScopeKey(targetCategoryId: string | null) {
  return targetCategoryId || NO_TARGET_CATEGORY_SCOPE_KEY;
}

function normalizeKey(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("en")
    .replace(/\s+/g, " ");
}
