import "server-only";

export type SupplierProviderKey = "digikey" | "mouser" | "tme";

export type SupplierPartSearchItem = {
  manufacturerName: string;
  catalogNumber: string;
  description: string;
  sourceCategory: string | null;
  sourceAttributes: Array<{
    name: string;
    value: string;
    unit: string | null;
  }>;
};

export type SupplierPartSearchPage = {
  items: SupplierPartSearchItem[];
  nextOffset: number | null;
};

export type SupplierPartSearchResult =
  | {
      ok: true;
      page: SupplierPartSearchPage;
    }
  | {
      ok: false;
      error:
        | "missing-credentials"
        | "token-request-failed"
        | "search-request-failed";
    };

export type SupplierPartSearchInput = {
  workspaceId: string;
  query: string;
  limit?: number;
  offset?: number;
};

export type SupplierPartSearchProvider = {
  key: SupplierProviderKey;
  searchParts: (input: SupplierPartSearchInput) => Promise<SupplierPartSearchResult>;
};
