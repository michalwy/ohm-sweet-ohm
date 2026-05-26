"use server";

import { getCurrentWorkspaceContextBySlug } from "@/server/auth/currentContext";
import { getSupplierPartSearchProvider } from "@/server/integrations/providers";
import type {
  SupplierPartSearchResult,
  SupplierProviderKey
} from "@/server/integrations/types";

export async function searchSupplierPartsForWorkspace(input: {
  workspaceSlug: string;
  provider: SupplierProviderKey;
  query: string;
  limit?: number;
  offset?: number;
}): Promise<SupplierPartSearchResult> {
  try {
    const context = await getCurrentWorkspaceContextBySlug(input.workspaceSlug);

    if (!context) {
      return {
        ok: false,
        error: "search-request-failed"
      };
    }

    const provider = getSupplierPartSearchProvider(input.provider);

    if (!provider) {
      return {
        ok: false,
        error: "search-request-failed"
      };
    }

    const fixture = getE2ESupplierSearchFixture(input);
    if (fixture) {
      return fixture;
    }

    return provider.searchParts({
      workspaceId: context.workspace.id,
      query: input.query,
      limit: input.limit,
      offset: input.offset
    });
  } catch {
    return {
      ok: false,
      error: "search-request-failed"
    };
  }
}

function getE2ESupplierSearchFixture(input: {
  provider: SupplierProviderKey;
  query: string;
  limit?: number;
  offset?: number;
}): SupplierPartSearchResult | null {
  if (process.env.OSO_E2E_SUPPLIER_FIXTURE !== "1") {
    return null;
  }

  if (input.provider !== "digikey") {
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
