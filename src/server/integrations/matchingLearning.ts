import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { getTargetCategoryScopeKey } from "@/server/integrations/matchingKeys";
import type { SupplierProviderKey } from "@/server/integrations/types";

// Records supplier category, attribute and manufacturer matching statistics inside the caller's
// transaction. An internal helper of part creation, which has already authorized the actor; it is
// deliberately kept out of the "use server" module `matching.ts`, where every exported async
// function is also a server action the browser can call (#291).
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
