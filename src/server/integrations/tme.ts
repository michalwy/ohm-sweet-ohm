import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db/prisma";
import type {
  SupplierPartSearchInput,
  SupplierPartSearchItem,
  SupplierPartSearchProvider,
  SupplierPartSearchResult
} from "@/server/integrations/types";

const TME_TOKEN_ENDPOINT = "https://api.tme.eu/auth/token";
const TME_SEARCH_ENDPOINT = "https://api.tme.eu/products/search";
const TME_CATEGORY_LIST_ENDPOINT = "https://api.tme.eu/products/categories/list";
const TME_CATEGORY_CACHE_TTL_MS = 10 * 24 * 60 * 60 * 1000;
const TME_DEFAULT_COUNTRY = "PL";

type TmeTokenResponse = {
  access_token?: string;
};

type TmeSearchResponse = {
  status?: string;
  data?: {
    products?: unknown[] | { elements?: unknown[] };
    items?: unknown[];
    results?: unknown[];
    total?: number;
    count?: number;
    counters?: {
      total?: number;
    };
    parameters?: {
      elements?: unknown[];
    } | unknown[];
  };
  products?: unknown[];
  items?: unknown[];
  results?: unknown[];
  total?: number;
  count?: number;
};

export async function getWorkspaceTmeIntegration(workspaceId: string) {
  return prisma.workspaceTmeIntegration.findUnique({
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

export async function upsertWorkspaceTmeIntegration(input: {
  workspaceId: string;
  clientId: string;
  clientSecret: string;
}) {
  const now = new Date();

  return prisma.workspaceTmeIntegration.upsert({
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

export async function searchTmeParts(
  input: SupplierPartSearchInput
): Promise<SupplierPartSearchResult> {
  const normalizedQuery = input.query.trim();
  const pageSize = Math.max(1, Math.min(input.limit ?? 8, 50));
  const offset = Math.max(0, input.offset ?? 0);
  const page = Math.floor(offset / pageSize) + 1;

  if (normalizedQuery.length < 2) {
    return {
      ok: true,
      page: {
        items: [],
        nextOffset: null
      }
    };
  }

  const config = await getWorkspaceTmeIntegration(input.workspaceId);

  if (!config) {
    return { ok: false, error: "missing-credentials" };
  }

  const token = await fetchTmeAccessToken(config.clientId, config.clientSecret);

  if (!token) {
    return { ok: false, error: "token-request-failed" };
  }

  const searchParams = new URLSearchParams();
  searchParams.set("country", TME_DEFAULT_COUNTRY);
  searchParams.set("phrase", normalizedQuery);
  searchParams.set("limit", String(pageSize));
  searchParams.set("page", String(page));
  searchParams.append("scope[]", "products");
  searchParams.append("scope[]", "parameters");
  searchParams.append("scope[]", "counters");

  const response = await fetch(`${TME_SEARCH_ENDPOINT}?${searchParams.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept-Language": "en"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return { ok: false, error: "search-request-failed" };
  }

  const payload = (await response.json()) as TmeSearchResponse;
  if (payload.status && payload.status !== "OK") {
    return { ok: false, error: "search-request-failed" };
  }

  const categoryPathById = await getOrRefreshTmeCategoryPathById({
    workspaceId: input.workspaceId,
    token,
    country: TME_DEFAULT_COUNTRY
  });

  const products = getSearchProducts(payload);
  const sharedSourceAttributes = extractSharedSourceAttributes(payload);

  const mapped = products
    .map((product) =>
      mapTmeProduct(product, categoryPathById, sharedSourceAttributes)
    )
    .filter((item): item is SupplierPartSearchItem => item !== null);

  const total = getSearchTotal(payload);

  const nextOffset =
    total !== null
      ? offset + mapped.length < total
        ? offset + mapped.length
        : null
      : mapped.length === pageSize
        ? offset + mapped.length
        : null;

  return {
    ok: true,
    page: {
      items: mapped,
      nextOffset
    }
  };
}

export const tmePartSearchProvider: SupplierPartSearchProvider = {
  key: "tme",
  searchParts: searchTmeParts
};

export async function fetchTmeProductParameters(input: {
  workspaceId: string;
  symbol: string;
  country?: string;
}) {
  const symbol = input.symbol.trim();
  if (!symbol) {
    return [] as SupplierPartSearchItem["sourceAttributes"];
  }

  const config = await getWorkspaceTmeIntegration(input.workspaceId);
  if (!config) {
    return [] as SupplierPartSearchItem["sourceAttributes"];
  }

  const token = await fetchTmeAccessToken(config.clientId, config.clientSecret);
  if (!token) {
    return [] as SupplierPartSearchItem["sourceAttributes"];
  }

  const params = new URLSearchParams();
  params.set("country", input.country ?? TME_DEFAULT_COUNTRY);
  params.append("symbols[]", symbol);

  const response = await fetch(`https://api.tme.eu/products/parameters?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Accept-Language": "en"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return [] as SupplierPartSearchItem["sourceAttributes"];
  }

  const payload = (await response.json()) as {
    status?: string;
    data?: {
      elements?: Array<{
        symbol?: string;
        parameters?: {
          elements?: unknown[];
        };
      }>;
    };
  };

  if (payload.status && payload.status !== "OK") {
    return [] as SupplierPartSearchItem["sourceAttributes"];
  }

  const element = payload.data?.elements?.find(
    (item) => typeof item.symbol === "string" && item.symbol.trim() === symbol
  );
  const parameterRows = Array.isArray(element?.parameters?.elements)
    ? element.parameters.elements
    : [];

  return mapParameterRowsToSourceAttributes(parameterRows);
}

async function fetchTmeAccessToken(clientId: string, clientSecret: string) {
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");

  const response = await fetch(TME_TOKEN_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`
    },
    body: new URLSearchParams({
      grant_type: "client_credentials"
    }),
    cache: "no-store"
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as TmeTokenResponse;
  return payload.access_token ?? null;
}

function mapTmeProduct(
  product: unknown,
  categoryPathById: Map<number, string>,
  sharedSourceAttributes: SupplierPartSearchItem["sourceAttributes"]
): SupplierPartSearchItem | null {
  if (typeof product !== "object" || product === null) {
    return null;
  }

  const record = product as Record<string, unknown>;
  const manufacturerName =
    getStringValue(
      record,
      "Producer",
      "producer",
      "Manufacturer",
      "manufacturer",
      "ProducerName",
      "producerName"
    ) ??
    getStringPathValue(
      record,
      "producer.name",
      "manufacturer.name",
      "brand.name"
    ) ??
    findStringByAnyKey(record, ["producer", "manufacturer", "brand"]);
  const catalogNumber =
    getStringValue(
      record,
      "Symbol",
      "symbol",
      "OriginalSymbol",
      "originalSymbol",
      "ProductSymbol",
      "productSymbol",
      "PartNumber",
      "partNumber"
    ) ??
    getStringPathValue(record, "product.symbol", "product.partNumber") ??
    findStringByAnyKey(record, ["symbol", "partnumber", "catalog"]);
  const description =
    getStringValue(
      record,
      "Description",
      "description",
      "ProductInformation",
      "name",
      "ProductName",
      "productName"
    ) ??
    getStringPathValue(record, "product.description", "product.name") ??
    catalogNumber;

  if (!manufacturerName || !catalogNumber) {
    return null;
  }

  const productSourceAttributes = extractSourceAttributes(record);

  return {
    manufacturerName,
    catalogNumber,
    description: description ?? catalogNumber,
    sourceCategory: getSourceCategoryPath(record, categoryPathById),
    sourceAttributes:
      productSourceAttributes.length > 0
        ? productSourceAttributes
        : sharedSourceAttributes
  };
}

function getStringValue(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
}

function getStringPathValue(
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

function findStringByAnyKey(
  source: Record<string, unknown>,
  keyIncludes: string[]
): string | null {
  for (const [key, value] of Object.entries(source)) {
    const normalizedKey = key.toLocaleLowerCase("en");
    if (!keyIncludes.some((keyword) => normalizedKey.includes(keyword))) {
      continue;
    }

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }
  }

  return null;
}

function getSearchProducts(payload: TmeSearchResponse) {
  const productsElements =
    typeof payload.data?.products === "object" &&
    payload.data?.products !== null &&
    Array.isArray((payload.data.products as { elements?: unknown[] }).elements)
      ? (payload.data.products as { elements?: unknown[] }).elements
      : null;

  const candidates = [
    productsElements,
    payload.data?.products,
    payload.data?.items,
    payload.data?.results,
    payload.products,
    payload.items,
    payload.results
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }

  return [];
}

function getSearchTotal(payload: TmeSearchResponse): number | null {
  const candidates = [
    payload.data?.counters?.total,
    payload.data?.total,
    payload.total,
    payload.data?.count,
    payload.count
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate) && candidate >= 0) {
      return candidate;
    }
  }

  return null;
}

function extractSourceAttributes(source: Record<string, unknown>) {
  const parametersCandidates = [
    getNestedValue(source, "Parameters"),
    getNestedValue(source, "parameters"),
    getNestedValue(source, "ProductParameters"),
    getNestedValue(source, "productParameters")
  ];

  const parameters = parametersCandidates.find((candidate) => Array.isArray(candidate));
  if (!Array.isArray(parameters)) {
    return [];
  }

  const result: SupplierPartSearchItem["sourceAttributes"] = [];

  for (const item of parameters) {
    if (typeof item !== "object" || item === null) {
      continue;
    }

    const record = item as Record<string, unknown>;
    const name =
      getStringValue(record, "Name", "name", "ParameterName", "parameterName") ?? null;
    const value =
      getStringValue(record, "Value", "value", "ParameterValue", "parameterValue") ?? null;
    const unit =
      getStringValue(record, "Unit", "unit", "UnitSymbol", "unitSymbol") ?? null;

    if (!name || !value) {
      continue;
    }

    result.push({ name, value, unit });
  }

  return result;
}

function extractSharedSourceAttributes(payload: TmeSearchResponse) {
  const parameterCandidates = [
    Array.isArray(payload.data?.parameters)
      ? payload.data?.parameters
      : Array.isArray(payload.data?.parameters?.elements)
        ? payload.data?.parameters.elements
        : null
  ];
  const parameters = parameterCandidates.find((candidate) => Array.isArray(candidate));
  if (!Array.isArray(parameters)) {
    return [];
  }

  return mapParameterRowsToSourceAttributes(parameters);
}

function mapParameterRowsToSourceAttributes(rows: unknown[]) {
  const sourceAttributes: SupplierPartSearchItem["sourceAttributes"] = [];

  for (const parameter of rows) {
    if (typeof parameter !== "object" || parameter === null) {
      continue;
    }

    const record = parameter as Record<string, unknown>;
    const parameterName =
      getStringValue(record, "name", "Name", "parameterName", "ParameterName") ??
      null;
    const values = Array.isArray(record.values) ? record.values : [];

    if (!parameterName || values.length === 0) {
      continue;
    }

    const joinedValues = values
      .map((valueEntry) => {
        if (typeof valueEntry !== "object" || valueEntry === null) {
          return null;
        }

        const valueRecord = valueEntry as Record<string, unknown>;
        return getStringValue(valueRecord, "value", "Value");
      })
      .filter((value): value is string => Boolean(value))
      .slice(0, 5);

    if (joinedValues.length === 0) {
      continue;
    }

    sourceAttributes.push({
      name: parameterName,
      value: joinedValues.join(", "),
      unit: null
    });
  }

  return sourceAttributes;
}

async function getOrRefreshTmeCategoryPathById(input: {
  workspaceId: string;
  token: string;
  country: string;
}) {
  const cached = await prisma.workspaceTmeCategoryCache.findUnique({
    where: {
      workspaceId_country: {
        workspaceId: input.workspaceId,
        country: input.country
      }
    },
    select: {
      categoriesJson: true,
      fetchedAt: true
    }
  });

  const now = Date.now();
  const isFresh =
    cached &&
    now - cached.fetchedAt.getTime() < TME_CATEGORY_CACHE_TTL_MS;

  if (isFresh) {
    return buildCategoryPathMap(cached.categoriesJson);
  }

  const refreshed = await fetchTmeCategoryList({
    token: input.token,
    country: input.country
  });

  if (refreshed.length > 0) {
    await prisma.workspaceTmeCategoryCache.upsert({
      where: {
        workspaceId_country: {
          workspaceId: input.workspaceId,
          country: input.country
        }
      },
      create: {
        workspaceId: input.workspaceId,
        country: input.country,
        categoriesJson: refreshed as Prisma.InputJsonValue,
        fetchedAt: new Date()
      },
      update: {
        categoriesJson: refreshed as Prisma.InputJsonValue,
        fetchedAt: new Date()
      }
    });

    return buildCategoryPathMap(refreshed);
  }

  if (cached) {
    return buildCategoryPathMap(cached.categoriesJson);
  }

  return new Map<number, string>();
}

async function fetchTmeCategoryList(input: { token: string; country: string }) {
  const params = new URLSearchParams();
  params.set("country", input.country);

  const response = await fetch(`${TME_CATEGORY_LIST_ENDPOINT}?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${input.token}`,
      "Accept-Language": "en"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as {
    status?: string;
    data?: { elements?: unknown[] };
  };

  if (payload.status && payload.status !== "OK") {
    return [];
  }

  return Array.isArray(payload.data?.elements) ? payload.data.elements : [];
}

function buildCategoryPathMap(categoriesJson: unknown) {
  if (!Array.isArray(categoriesJson)) {
    return new Map<number, string>();
  }

  const rows = categoriesJson
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) {
        return null;
      }

      const record = entry as Record<string, unknown>;
      const id = toNumber(record.id);
      const parentId = toNumber(record.parent_id);
      const name = getStringValue(record, "name", "Name") ?? "";

      if (id === null) {
        return null;
      }

      return {
        id,
        parentId,
        name
      };
    })
    .filter((row): row is { id: number; parentId: number | null; name: string } => row !== null);

  const rowById = new Map<number, { id: number; parentId: number | null; name: string }>();
  for (const row of rows) {
    rowById.set(row.id, row);
  }

  const pathById = new Map<number, string>();

  function resolvePath(categoryId: number, depth: number): string {
    if (depth > 32) {
      return "";
    }

    const cached = pathById.get(categoryId);
    if (cached !== undefined) {
      return cached;
    }

    const node = rowById.get(categoryId);
    if (!node) {
      return "";
    }

    const parentPath =
      node.parentId !== null && node.parentId !== node.id
        ? resolvePath(node.parentId, depth + 1)
        : "";
    const ownName = node.name.trim();
    const fullPath =
      parentPath && ownName
        ? `${parentPath} > ${ownName}`
        : ownName || parentPath;

    pathById.set(categoryId, fullPath);
    return fullPath;
  }

  for (const row of rows) {
    resolvePath(row.id, 0);
  }

  return pathById;
}

function getSourceCategoryPath(
  product: Record<string, unknown>,
  categoryPathById: Map<number, string>
) {
  const rawCategory = getNestedValue(product, "category") ?? getNestedValue(product, "Category");

  if (typeof rawCategory === "object" && rawCategory !== null) {
    const category = rawCategory as Record<string, unknown>;
    const categoryId = toNumber(category.id);
    if (categoryId !== null) {
      const path = categoryPathById.get(categoryId);
      if (path) {
        return path;
      }
    }

    const fallbackName = getStringValue(category, "name", "Name");
    if (fallbackName) {
      return fallbackName;
    }
  }

  return (
    getStringPathValue(product, "Category.Name", "category.name", "CategoryName", "categoryName") ??
    null
  );
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}
