import "server-only";

import { prisma } from "@/server/db/prisma";
import {
  buildSourceAttributeKey,
  formatSourceAttributeDisplay,
  getTargetCategoryScopeKey,
  normalizeSourceCategoryKey,
  normalizeSourceManufacturerKey,
  normalizeSourceValue
} from "@/server/integrations/matchingKeys";
import { getWorkspaceActiveSupplierProvider } from "@/server/integrations/providerSettings";
import { getSupplierPartSearchProvider } from "@/server/integrations/providers";
import { fetchTmeProductParameters } from "@/server/integrations/tme";
import type {
  SupplierPartSearchItem,
  SupplierPartSearchResult,
  SupplierProviderKey
} from "@/server/integrations/types";

/**
 * Supplier lookup — searching the workspace's active supplier, reading a supplier part's
 * attributes, and the matching suggestions for a supplier part — shared by the server actions the
 * add-part dialog calls (`supplierActions.ts`, `matching.ts`) and the API and MCP (#285). The
 * caller has already resolved and authorized the actor; these functions take its workspace id.
 *
 * Every request to DigiKey or TME is made by the provider modules (`digikey.ts`, `tme.ts`) from the
 * same arguments the UI passes, so the API sends exactly the payloads the UI sends (the owner's
 * guardrail decision in #285). Credentials never leave this layer.
 */

export type SupplierSearchOutcome =
  | { ok: true; provider: SupplierProviderKey; page: SupplierPartSearchResult & { ok: true } }
  | {
      ok: false;
      provider: SupplierProviderKey | null;
      error: "missing-credentials" | "token-request-failed" | "search-request-failed";
    };

export async function searchSupplierParts(input: {
  workspaceId: string;
  query: string;
  limit?: number;
  offset?: number;
}): Promise<SupplierSearchOutcome> {
  const activeProvider = await getWorkspaceActiveSupplierProvider(input.workspaceId);

  if (!activeProvider) {
    return { ok: false, provider: null, error: "missing-credentials" };
  }

  const provider = getSupplierPartSearchProvider(activeProvider);

  if (!provider) {
    return { ok: false, provider: activeProvider, error: "search-request-failed" };
  }

  try {
    const result =
      getE2ESupplierSearchFixture({
        provider: activeProvider,
        query: input.query,
        limit: input.limit,
        offset: input.offset
      }) ??
      (await provider.searchParts({
        workspaceId: input.workspaceId,
        query: input.query,
        limit: input.limit,
        offset: input.offset
      }));

    return result.ok
      ? { ok: true, provider: activeProvider, page: result }
      : { ok: false, provider: activeProvider, error: result.error };
  } catch {
    return { ok: false, provider: activeProvider, error: "search-request-failed" };
  }
}

/**
 * A supplier part's attributes, read from the supplier by its catalog number. Only TME has such a
 * lookup; for any other provider, or when TME returns nothing, the answer is `null` and the
 * attributes of the search result are the ones to use (the UI's "search fallback").
 */
export async function getSupplierPartAttributes(input: {
  workspaceId: string;
  catalogNumber: string;
}): Promise<{
  provider: SupplierProviderKey | null;
  sourceAttributes: SupplierPartSearchItem["sourceAttributes"] | null;
}> {
  const provider = await getWorkspaceActiveSupplierProvider(input.workspaceId);

  if (provider !== "tme") {
    return { provider, sourceAttributes: null };
  }

  try {
    const sourceAttributes = await fetchTmeProductParameters({
      workspaceId: input.workspaceId,
      symbol: input.catalogNumber
    });

    return { provider, sourceAttributes: sourceAttributes.length > 0 ? sourceAttributes : null };
  } catch {
    return { provider, sourceAttributes: null };
  }
}

export type SupplierAttributeDraft = {
  sourceAttribute: string;
  sourceAttributeName: string;
  sourceUnit: string | null;
  sourceAttributeKey: string;
  sourceValue: string;
  suggestedTargetAttributeId: string | null;
};

export type SupplierMatchingSuggestions = {
  sourceCategoryKey: string;
  sourceManufacturerKey: string;
  suggestedTargetCategoryId: string | null;
  suggestedTargetManufacturerName: string | null;
  attributeRows: SupplierAttributeDraft[];
};

/**
 * What the workspace has learned from earlier parts created from supplier results: the category,
 * the manufacturer and, per supplier attribute, the workspace attribute it was matched to most
 * often. Reads only this workspace's statistics; makes no request to the supplier.
 */
export async function getSupplierMatchingSuggestions(input: {
  workspaceId: string;
  provider: SupplierProviderKey;
  sourceManufacturerName?: string | null;
  sourceCategory: string | null;
  sourceAttributes: Array<{
    sourceAttribute: string;
    sourceValue: string;
    sourceUnit?: string | null;
  }>;
  targetCategoryId: string | null;
}): Promise<SupplierMatchingSuggestions> {
  const sourceCategoryKey = normalizeSourceCategoryKey(input.sourceCategory);
  const targetCategoryScopeKey = getTargetCategoryScopeKey(input.targetCategoryId);
  const sourceManufacturerKey = normalizeSourceManufacturerKey(input.sourceManufacturerName);

  const [categoryCandidates, attributeCandidates, manufacturerCandidates] = await Promise.all([
    prisma.supplierCategoryMappingStat.findMany({
      where: { workspaceId: input.workspaceId, provider: input.provider, sourceCategoryKey },
      orderBy: [{ score: "desc" }, { lastUsedAt: "desc" }, { createdAt: "desc" }],
      select: { targetCategoryId: true, score: true, lastUsedAt: true }
    }),
    prisma.supplierAttributeMappingStat.findMany({
      where: {
        workspaceId: input.workspaceId,
        provider: input.provider,
        sourceCategoryKey,
        targetCategoryScopeKey
      },
      orderBy: [{ score: "desc" }, { lastUsedAt: "desc" }, { createdAt: "desc" }],
      select: { sourceAttributeKey: true, targetAttributeId: true, score: true, lastUsedAt: true }
    }),
    prisma.supplierManufacturerMappingStat.findMany({
      where: { workspaceId: input.workspaceId, provider: input.provider, sourceManufacturerKey },
      orderBy: [{ score: "desc" }, { lastUsedAt: "desc" }, { createdAt: "desc" }],
      select: { targetManufacturer: { select: { name: true } } }
    })
  ]);

  const bestTargetCategoryId = categoryCandidates[0]?.targetCategoryId ?? null;
  const bestTargetBySourceAttribute = new Map<string, string>();

  for (const candidate of attributeCandidates) {
    if (!bestTargetBySourceAttribute.has(candidate.sourceAttributeKey)) {
      bestTargetBySourceAttribute.set(candidate.sourceAttributeKey, candidate.targetAttributeId);
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
        suggestedTargetAttributeId: bestTargetBySourceAttribute.get(sourceAttributeKey) ?? null
      };
    })
    .filter((item): item is SupplierAttributeDraft => item !== null);

  return {
    sourceCategoryKey,
    sourceManufacturerKey,
    suggestedTargetCategoryId: bestTargetCategoryId,
    suggestedTargetManufacturerName: manufacturerCandidates[0]?.targetManufacturer.name ?? null,
    attributeRows: rows
  };
}

function getE2ESupplierSearchFixture(input: {
  provider: SupplierProviderKey;
  query: string;
  limit?: number;
  offset?: number;
}): (SupplierPartSearchResult & { ok: true }) | null {
  if (process.env.OSO_E2E_SUPPLIER_FIXTURE !== "1") {
    return null;
  }

  if (input.provider !== "digikey" && input.provider !== "tme") {
    return null;
  }

  const normalizedQuery = input.query.trim().toLocaleLowerCase("en");
  if (!normalizedQuery.includes("e2e-ne555")) {
    return null;
  }

  const items = [
    {
      manufacturerName: "Texas Instruments",
      catalogNumber: "E2E-NE555A",
      description: "E2E 555 timer fixture A",
      sourceCategory:
        "Integrated Circuits (ICs) » Clock/Timing » Programmable Timers and Oscillators",
      sourceAttributes: [
        { name: "Frequency", value: "100kHz", unit: null },
        { name: "Package / Case", value: "8-DIP (0.300\", 7.62mm)", unit: null }
      ]
    },
    {
      manufacturerName: "Texas Instruments",
      catalogNumber: "E2E-NE555B",
      description: "E2E 555 timer fixture B",
      sourceCategory:
        "Integrated Circuits (ICs) » Clock/Timing » Programmable Timers and Oscillators",
      sourceAttributes: [
        { name: "Frequency", value: "500kHz", unit: null },
        { name: "Package / Case", value: "8-SOIC (0.154\", 3.90mm Width)", unit: null }
      ]
    }
  ];
  const pageSize = Math.max(1, Math.min(input.limit ?? items.length, items.length));
  const offset = Math.max(0, input.offset ?? 0);
  const pageItems = items.slice(offset, offset + pageSize);
  const nextOffset = offset + pageItems.length < items.length ? offset + pageItems.length : null;

  return {
    ok: true,
    page: {
      items: pageItems,
      nextOffset
    }
  };
}
