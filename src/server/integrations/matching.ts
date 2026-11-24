"use server";

import { requireActorPermission } from "@/server/access-control/actor";
import { resolveWorkspaceActor } from "@/server/auth/currentActor";
import { prisma } from "@/server/db/prisma";
import {
  buildSourceAttributeKey,
  formatSourceAttributeDisplay,
  getTargetCategoryScopeKey,
  normalizeSourceCategoryKey,
  normalizeSourceManufacturerKey,
  normalizeSourceValue
} from "@/server/integrations/matchingKeys";
import type { SupplierProviderKey } from "@/server/integrations/types";

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
  const context = await resolveWorkspaceActor({ kind: "session", workspaceSlug: input.workspaceSlug });

  if (!context) {
    return { ok: false as const, error: "database-unavailable" };
  }

  requireActorPermission(context, "parts:write");

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
