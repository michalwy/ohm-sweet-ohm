import "server-only";

import { prisma } from "@/server/db/prisma";
import { PART_CATEGORY_PATH_SEPARATOR } from "@/server/parts/categories";
import type {
  SupplierPartSearchInput,
  SupplierPartSearchItem,
  SupplierPartSearchProvider,
  SupplierPartSearchResult
} from "@/server/integrations/types";

const DIGIKEY_TOKEN_ENDPOINT = "https://api.digikey.com/v1/oauth2/token";
const DIGIKEY_KEYWORD_SEARCH_ENDPOINT =
  "https://api.digikey.com/products/v4/search/keyword";

type DigiKeyTokenResponse = {
  access_token?: string;
};

type DigiKeySearchApiResult = {
  productCount?: number;
  ProductsCount?: number;
  products?: unknown[];
  exactMatches?: unknown[];
  Products?: unknown[];
  ProductCount?: number;
  ExactMatches?: unknown[];
};

export type DigiKeyPartSearchItem = SupplierPartSearchItem;
export type DigiKeyPartSearchResult = SupplierPartSearchResult;

export async function getWorkspaceDigiKeyIntegration(workspaceId: string) {
  return prisma.workspaceDigiKeyIntegration.findUnique({
    where: {
      workspaceId
    },
    select: {
      workspaceId: true,
      clientId: true,
      clientSecret: true,
      updatedAt: true
    }
  });
}

export async function upsertWorkspaceDigiKeyIntegration(input: {
  workspaceId: string;
  clientId: string;
  clientSecret: string;
}) {
  const now = new Date();

  return prisma.workspaceDigiKeyIntegration.upsert({
    where: {
      workspaceId: input.workspaceId
    },
    create: {
      workspaceId: input.workspaceId,
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      updatedAt: now
    },
    update: {
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      updatedAt: now
    }
  });
}

export async function searchDigiKeyParts(
  input: SupplierPartSearchInput
): Promise<DigiKeyPartSearchResult> {
  const normalizedQuery = input.query.trim();
  const offset = Math.max(0, input.offset ?? 0);
  const pageSize = Math.max(1, Math.min(input.limit ?? 8, 20));

  if (normalizedQuery.length < 3) {
    return {
      ok: true,
      page: {
        items: [],
        nextOffset: null
      }
    };
  }

  const config = await getWorkspaceDigiKeyIntegration(input.workspaceId);

  if (!config) {
    return { ok: false, error: "missing-credentials" };
  }

  const token = await fetchDigiKeyAccessToken(config.clientId, config.clientSecret);

  if (!token) {
    return { ok: false, error: "token-request-failed" };
  }

  const response = await fetch(DIGIKEY_KEYWORD_SEARCH_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-DIGIKEY-Client-Id": config.clientId,
      "X-DIGIKEY-Locale-Site": "US",
      "X-DIGIKEY-Locale-Language": "en",
      "X-DIGIKEY-Locale-Currency": "USD"
    },
    body: JSON.stringify({
      Keywords: normalizedQuery,
      Limit: pageSize,
      Offset: offset,
      SearchOptions: ["ManufacturerPartSearch"]
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    return { ok: false, error: "search-request-failed" };
  }

  const payload = (await response.json()) as DigiKeySearchApiResult;
  const rawProducts = getSearchProducts(payload);

  const mapped = rawProducts
    .map((product) => {
      const manufacturerName =
        getStringValue(
          product,
          "Manufacturer.Name",
          "manufacturer.name",
          "ManufacturerValue",
          "Supplier",
          "Brand"
        ) ??
        findStringByAnyKey(product, [
          "manufacturername",
          "manufacturer",
          "brand",
          "supplier"
        ]);
      const catalogNumber =
        getStringValue(
          product,
          "ManufacturerPartNumber",
          "manufacturerPartNumber",
          "ManufacturerProductNumber",
          "manufacturerProductNumber",
          "MfrPartNumber",
          "mfrPartNumber",
          "DigiKeyPartNumber",
          "digiKeyPartNumber",
          "ProductNumber",
          "productNumber"
        ) ??
        findStringByAnyKey(product, [
          "manufacturerpartnumber",
          "manufacturerproductnumber",
          "mfrpartnumber",
          "digikeypartnumber",
          "productnumber",
          "partnumber"
        ]);
      const description =
        getStringValue(
          product,
          "Description.ProductDescription",
          "description.productDescription",
          "ProductDescription",
          "productDescription",
          "Description",
          "PimProductName",
          "ProductName"
        ) ??
        findStringByAnyKey(product, [
          "productdescription",
          "description",
          "productname",
          "name"
        ]) ??
        catalogNumber;

      if (!manufacturerName || !catalogNumber) {
        return null;
      }

      const sourceCategory = getSourceCategoryPath(product);

      const sourceAttributes = extractSourceAttributes(product);

      return {
        manufacturerName,
        catalogNumber,
        description,
        sourceCategory: sourceCategory ?? null,
        sourceAttributes
      };
    })
    .filter((item): item is DigiKeyPartSearchItem => item !== null);

  const unique = new Map<string, DigiKeyPartSearchItem>();

  for (const item of mapped) {
    const dedupeKey = `${item.manufacturerName}::${item.catalogNumber}`;
    if (!unique.has(dedupeKey)) {
      unique.set(dedupeKey, item);
    }
  }

  const items = [...unique.values()].slice(0, pageSize);
  const totalCount = getProductCount(payload);
  const nextStartPosition =
    totalCount !== null
      ? offset + items.length < totalCount
        ? offset + items.length
        : null
      : items.length === pageSize
        ? offset + items.length
        : null;

  return {
    ok: true,
    page: {
      items,
      nextOffset: nextStartPosition
    }
  };
}

export const digiKeyPartSearchProvider: SupplierPartSearchProvider = {
  key: "digikey",
  searchParts: searchDigiKeyParts
};

async function fetchDigiKeyAccessToken(clientId: string, clientSecret: string) {
  const response = await fetch(DIGIKEY_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "client_credentials"
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as DigiKeyTokenResponse;
  return payload.access_token ?? null;
}

function getSearchProducts(payload: DigiKeySearchApiResult) {
  const exactMatches = Array.isArray(payload.ExactMatches)
    ? payload.ExactMatches
    : Array.isArray(payload.exactMatches)
      ? payload.exactMatches
      : [];

  const products = Array.isArray(payload.Products)
    ? payload.Products
    : Array.isArray(payload.products)
      ? payload.products
      : [];

  const merged = [...exactMatches, ...products];

  return merged.filter(
    (entry): entry is Record<string, unknown> =>
      typeof entry === "object" && entry !== null
  );
}

function getProductCount(payload: DigiKeySearchApiResult): number | null {
  const fromPluralUpper = payload.ProductsCount;
  const fromUpper = payload.ProductCount;
  const fromLower = payload.productCount;
  const value =
    typeof fromPluralUpper === "number"
      ? fromPluralUpper
      : typeof fromUpper === "number"
        ? fromUpper
        : fromLower;

  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function getStringValue(
  source: Record<string, unknown>,
  ...paths: string[]
): string | null {
  for (const path of paths) {
    const value = getNestedValue(source, path);
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
}

function getNestedValue(source: Record<string, unknown>, path: string): unknown {
  const segments = path.split(".");
  let current: unknown = source;

  for (const segment of segments) {
    if (typeof current !== "object" || current === null) {
      return null;
    }

    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}

function getSourceCategoryPath(product: Record<string, unknown>) {
  const categoryTreePath = getCategoryTreePathFromProduct(product);
  if (categoryTreePath) {
    return normalizeCategoryPathDisplay(categoryTreePath);
  }

  const explicitPath =
    getStringValue(
      product,
      "CategoryPath",
      "categoryPath",
      "Category.Path",
      "category.path",
      "FamilyPath",
      "familyPath"
    ) ?? findCategoryPathByKey(product);

  if (explicitPath) {
    return normalizeCategoryPathDisplay(explicitPath);
  }

  const categoryName =
    getStringValue(product, "Category.Name", "CategoryName", "category.name", "categoryName") ??
    findStringByAnyKey(product, ["categoryname", "category"]);
  const familyName =
    getStringValue(product, "Family.Name", "FamilyName", "family.name", "familyName") ??
    findStringByAnyKey(product, ["familyname", "family"]);

  if (categoryName && familyName) {
    if (normalizePathSegment(categoryName) === normalizePathSegment(familyName)) {
      return categoryName;
    }

    return normalizeCategoryPathDisplay(`${categoryName} / ${familyName}`);
  }

  return categoryName ?? familyName;
}

function getCategoryTreePathFromProduct(product: Record<string, unknown>) {
  const category = getNestedValue(product, "Category");
  if (typeof category !== "object" || category === null) {
    return null;
  }

  const segments = collectCategoryPathSegments(category as Record<string, unknown>);
  if (segments.length === 0) {
    return null;
  }

  return segments.join(PART_CATEGORY_PATH_SEPARATOR);
}

function collectCategoryPathSegments(node: Record<string, unknown>): string[] {
  const currentName = getStringValue(node, "Name", "name");
  const childrenRaw = node["ChildCategories"];
  const children = Array.isArray(childrenRaw)
    ? childrenRaw.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" && item !== null
      )
    : [];
  const deepestChildPath = findDeepestCategoryPath(children);

  if (!currentName) {
    return deepestChildPath;
  }

  return [currentName, ...deepestChildPath];
}

function findDeepestCategoryPath(
  nodes: Array<Record<string, unknown>>
): string[] {
  let best: string[] = [];

  for (const node of nodes) {
    const candidate = collectCategoryPathSegments(node);
    if (candidate.length > best.length) {
      best = candidate;
    }
  }

  return best;
}

function normalizePathSegment(value: string) {
  return value.trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
}

function normalizeCategoryPathDisplay(path: string) {
  return path.trim().replace(/\s*\/\s*/g, PART_CATEGORY_PATH_SEPARATOR);
}

function findCategoryPathByKey(source: Record<string, unknown>) {
  const wanted = new Set(
    [
      "categorypath",
      "path",
      "category_path",
      "familypath",
      "taxonomy"
    ].map((key) => key.toLocaleLowerCase("en"))
  );
  const visited = new Set<unknown>();

  return scanNodeForCategoryPath(source, wanted, visited);
}

function scanNodeForCategoryPath(
  value: unknown,
  wanted: Set<string>,
  visited: Set<unknown>
): string | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  if (visited.has(value)) {
    return null;
  }

  visited.add(value);

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = scanNodeForCategoryPath(item, wanted, visited);
      if (found) {
        return found;
      }
    }
    return null;
  }

  for (const [rawKey, child] of Object.entries(value)) {
    const normalizedKey = rawKey.toLocaleLowerCase("en");
    if (typeof child === "string") {
      const trimmed = child.trim();
      if (trimmed.includes("/") && wanted.has(normalizedKey)) {
        return trimmed;
      }
    }
  }

  for (const child of Object.values(value)) {
    const found = scanNodeForCategoryPath(child, wanted, visited);
    if (found) {
      return found;
    }
  }

  return null;
}

function extractSourceAttributes(product: Record<string, unknown>) {
  const parameterCollections = [
    getNestedValue(product, "Parameters"),
    getNestedValue(product, "parameters"),
    getNestedValue(product, "ProductVariations"),
    getNestedValue(product, "productVariations")
  ];
  const attributes: Array<{ name: string; value: string; unit: string | null }> = [];

  for (const collection of parameterCollections) {
    if (!Array.isArray(collection)) {
      continue;
    }

    for (const entry of collection) {
      if (typeof entry !== "object" || entry === null) {
        continue;
      }

      const item = entry as Record<string, unknown>;
      const name =
        getStringValue(item, "ParameterText", "parameterText", "Name", "name") ??
        findStringByAnyKey(item, ["parametertext", "name", "parameter"]);
      const value =
        getStringValue(
          item,
          "ValueText",
          "valueText",
          "Value",
          "value",
          "ValueDescription",
          "valueDescription"
        ) ?? findStringByAnyKey(item, ["valuetext", "value", "valuedescription"]);
      const unit =
        getStringValue(item, "UnitText", "unitText", "Unit", "unit") ??
        findStringByAnyKey(item, ["unittext", "unit"]);

      if (!name || !value) {
        continue;
      }

      attributes.push({
        name,
        value,
        unit: unit ?? null
      });
    }
  }

  const deduped = new Map<string, { name: string; value: string; unit: string | null }>();

  for (const attribute of attributes) {
    const dedupeKey = `${attribute.name.trim().toLowerCase()}::${attribute.unit?.trim().toLowerCase() ?? ""}`;
    if (!deduped.has(dedupeKey)) {
      deduped.set(dedupeKey, attribute);
    }
  }

  return [...deduped.values()];
}

function findStringByAnyKey(
  source: Record<string, unknown>,
  keys: string[]
): string | null {
  const wanted = new Set(keys.map((key) => key.toLocaleLowerCase("en")));
  const visited = new Set<unknown>();

  return scanNodeForString(source, wanted, visited);
}

function scanNodeForString(
  node: unknown,
  wantedKeys: Set<string>,
  visited: Set<unknown>
): string | null {
  if (typeof node !== "object" || node === null) {
    return null;
  }

  if (visited.has(node)) {
    return null;
  }
  visited.add(node);

  if (Array.isArray(node)) {
    for (const item of node) {
      const match = scanNodeForString(item, wantedKeys, visited);
      if (match) {
        return match;
      }
    }
    return null;
  }

  for (const [key, value] of Object.entries(node)) {
    const normalizedKey = key.toLocaleLowerCase("en");
    if (wantedKeys.has(normalizedKey) && typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  for (const value of Object.values(node)) {
    const match = scanNodeForString(value, wantedKeys, visited);
    if (match) {
      return match;
    }
  }

  return null;
}
