import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { prisma } from "@/server/db/prisma";
import {
  decodeListCursor,
  encodeListCursor,
  getListPageSize,
  type ListPage
} from "@/server/pagination";

import {
  ORGANIZATION_ROLE_MANUFACTURER,
  ORGANIZATION_ROLE_SUPPLIER
} from "@/server/organizations/organizationOperations";

export {
  ORGANIZATION_ROLE_MANUFACTURER,
  ORGANIZATION_ROLE_SUPPLIER,
  ORGANIZATION_ROLES,
  type OrganizationRole
} from "@/server/organizations/organizationOperations";

export type OrganizationSummary = {
  id: string;
  name: string;
  roles: string[];
  currency: string | null;
  defaultPriceEntryMode: string | null;
  defaultTaxRate: string | null;
  createdAt: Date;
};

type NameCursor = { name: string; id: string };

const organizationSummarySelect = {
  id: true,
  name: true,
  currency: true,
  defaultPriceEntryMode: true,
  defaultTaxRate: true,
  createdAt: true,
  roles: { select: { role: true } }
} satisfies Prisma.OrganizationSelect;

function toOrganizationSummary(
  row: Prisma.OrganizationGetPayload<{ select: typeof organizationSummarySelect }>
): OrganizationSummary {
  return {
    id: row.id,
    name: row.name,
    currency: row.currency,
    defaultPriceEntryMode: row.defaultPriceEntryMode,
    defaultTaxRate: row.defaultTaxRate?.toString() ?? null,
    createdAt: row.createdAt,
    roles: row.roles.map((role) => role.role)
  };
}

export function normalizeOrganizationName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function ensureOrganizationWithRole({
  workspaceId,
  name,
  role
}: {
  workspaceId: string;
  name: string;
  role: string;
}) {
  const displayName = name.trim().replace(/\s+/g, " ");
  const normalizedName = normalizeOrganizationName(displayName);

  const organization = await prisma.organization.upsert({
    where: {
      workspaceId_normalizedName: {
        workspaceId,
        normalizedName
      }
    },
    update: {},
    create: {
      workspaceId,
      name: displayName,
      normalizedName
    },
    select: {
      id: true
    }
  });

  await prisma.organizationRole.upsert({
    where: {
      organizationId_role: {
        organizationId: organization.id,
        role
      }
    },
    update: {},
    create: {
      organizationId: organization.id,
      role
    }
  });

  return organization;
}

export type ManufacturerSuggestion = {
  id: string;
  name: string;
};

export async function getOrganizationsForWorkspace({
  userId,
  workspaceId,
  cursor,
  pageSize,
  sortDir = "asc",
  searchQuery,
  roleFilter
}: {
  userId: string;
  workspaceId: string;
  cursor?: string | null;
  pageSize?: number | null;
  sortDir?: "asc" | "desc";
  searchQuery?: string | null;
  roleFilter?: string | null;
}): Promise<ListPage<OrganizationSummary>> {
  await authorizeWorkspacePermission({
    userId,
    workspaceId,
    permission: "organizations:read"
  });

  const limit = getListPageSize(pageSize);
  const baseWhere: Prisma.OrganizationWhereInput = { workspaceId, isInternal: false };
  const whereClauses: Prisma.OrganizationWhereInput[] = [baseWhere];
  if (searchQuery) {
    whereClauses.push({ name: { contains: searchQuery, mode: "insensitive" } });
  }
  if (roleFilter) {
    whereClauses.push({ roles: { some: { role: roleFilter } } });
  }
  const filteredWhere: Prisma.OrganizationWhereInput =
    whereClauses.length > 1 ? { AND: whereClauses } : baseWhere;
  const hasFilters = whereClauses.length > 1;

  const totalCount = await prisma.organization.count({ where: baseWhere });
  const filteredCount = hasFilters
    ? await prisma.organization.count({ where: filteredWhere })
    : totalCount;

  const decoded = decodeListCursor<NameCursor>(cursor);
  const dir = sortDir === "asc" ? "asc" : "desc";

  const rows = await prisma.organization.findMany({
    where: decoded
      ? {
          AND: [
            filteredWhere,
            {
              OR: [
                { name: dir === "asc" ? { gt: decoded.name } : { lt: decoded.name } },
                { name: decoded.name, id: dir === "asc" ? { gt: decoded.id } : { lt: decoded.id } }
              ]
            }
          ]
        }
      : filteredWhere,
    orderBy: [{ name: dir }, { id: dir }],
    take: limit + 1,
    select: organizationSummarySelect
  });

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map(toOrganizationSummary);

  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last ? encodeListCursor<NameCursor>({ name: last.name, id: last.id }) : null;

  return { items, nextCursor, totalCount, filteredCount };
}

/**
 * One organization of the workspace, or null. The workspace's internal organization (the
 * workspace itself as manufacturer of its own designs) is never listed, so it is not found here
 * either (#279).
 */
export async function getOrganizationForWorkspace({
  userId,
  workspaceId,
  id
}: {
  userId: string;
  workspaceId: string;
  id: string;
}): Promise<OrganizationSummary | null> {
  await authorizeWorkspacePermission({
    userId,
    workspaceId,
    permission: "organizations:read"
  });

  const row = await prisma.organization.findFirst({
    where: { id, workspaceId, isInternal: false },
    select: organizationSummarySelect
  });

  return row ? toOrganizationSummary(row) : null;
}

export async function createOrganizationForWorkspace({
  userId,
  workspaceId,
  name,
  roles,
  currency,
  defaultPriceEntryMode,
  defaultTaxRate
}: {
  userId: string;
  workspaceId: string;
  name: string;
  roles: string[];
  currency?: string | null;
  defaultPriceEntryMode?: string | null;
  defaultTaxRate?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await authorizeWorkspacePermission({
    userId,
    workspaceId,
    permission: "organizations:write"
  });

  if (!name.trim()) {
    return { ok: false, error: "name_required" };
  }
  if (roles.length === 0) {
    return { ok: false, error: "role_required" };
  }

  const displayName = name.trim().replace(/\s+/g, " ");
  const normalizedName = normalizeOrganizationName(displayName);

  const existing = await prisma.organization.findUnique({
    where: { workspaceId_normalizedName: { workspaceId, normalizedName } },
    select: { id: true }
  });
  if (existing) {
    return { ok: false, error: "name_taken" };
  }

  const parsedDefaultTaxRate =
    defaultTaxRate && defaultTaxRate.trim()
      ? new Prisma.Decimal(defaultTaxRate.trim())
      : null;

  const org = await prisma.organization.create({
    data: {
      workspaceId,
      name: displayName,
      normalizedName,
      currency: currency || null,
      defaultPriceEntryMode: defaultPriceEntryMode || null,
      defaultTaxRate: parsedDefaultTaxRate,
      roles: {
        create: roles.map((role) => ({ role }))
      }
    },
    select: { id: true }
  });

  return { ok: true, id: org.id };
}

/**
 * Changes an organization. A field left undefined keeps its value, so the API can change one field
 * (#279); the form sends every field. `null` clears currency, price entry mode and tax rate.
 */
export async function updateOrganizationForWorkspace({
  userId,
  workspaceId,
  id,
  name,
  roles,
  currency,
  defaultPriceEntryMode,
  defaultTaxRate
}: {
  userId: string;
  workspaceId: string;
  id: string;
  name?: string;
  roles?: string[];
  currency?: string | null;
  defaultPriceEntryMode?: string | null;
  defaultTaxRate?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await authorizeWorkspacePermission({
    userId,
    workspaceId,
    permission: "organizations:write"
  });

  const org = await prisma.organization.findUnique({
    where: { id },
    select: { workspaceId: true, isInternal: true }
  });
  if (!org || org.workspaceId !== workspaceId || org.isInternal) {
    return { ok: false, error: "not_found" };
  }

  if (name !== undefined && !name.trim()) {
    return { ok: false, error: "name_required" };
  }
  if (roles !== undefined && roles.length === 0) {
    return { ok: false, error: "role_required" };
  }

  let nameData: { name: string; normalizedName: string } | undefined;
  if (name !== undefined) {
    const displayName = name.trim().replace(/\s+/g, " ");
    const normalizedName = normalizeOrganizationName(displayName);

    const existing = await prisma.organization.findUnique({
      where: { workspaceId_normalizedName: { workspaceId, normalizedName } },
      select: { id: true }
    });
    if (existing && existing.id !== id) {
      return { ok: false, error: "name_taken" };
    }
    nameData = { name: displayName, normalizedName };
  }

  const parsedUpdateTaxRate =
    defaultTaxRate === undefined
      ? undefined
      : defaultTaxRate && defaultTaxRate.trim()
        ? new Prisma.Decimal(defaultTaxRate.trim())
        : null;

  await prisma.$transaction([
    prisma.organization.update({
      where: { id },
      data: {
        ...nameData,
        currency: currency === undefined ? undefined : currency || null,
        defaultPriceEntryMode:
          defaultPriceEntryMode === undefined ? undefined : defaultPriceEntryMode || null,
        defaultTaxRate: parsedUpdateTaxRate
      }
    }),
    ...(roles === undefined
      ? []
      : [
          prisma.organizationRole.deleteMany({ where: { organizationId: id } }),
          prisma.organizationRole.createMany({
            data: roles.map((role) => ({ organizationId: id, role }))
          })
        ])
  ]);

  return { ok: true };
}

export async function deleteOrganizationForWorkspace({
  userId,
  workspaceId,
  id
}: {
  userId: string;
  workspaceId: string;
  id: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await authorizeWorkspacePermission({
    userId,
    workspaceId,
    permission: "organizations:write"
  });

  const org = await prisma.organization.findUnique({
    where: { id },
    select: {
      workspaceId: true,
      isInternal: true,
      _count: { select: { manufacturedParts: true, purchaseOrders: true } }
    }
  });

  if (!org || org.workspaceId !== workspaceId || org.isInternal) {
    return { ok: false, error: "not_found" };
  }
  if (org._count.manufacturedParts > 0) {
    return { ok: false, error: "referenced_by_parts" };
  }
  if (org._count.purchaseOrders > 0) {
    return { ok: false, error: "referenced_by_purchase_orders" };
  }

  await prisma.organization.delete({ where: { id } });
  return { ok: true };
}

export type SupplierSummary = {
  id: string;
  name: string;
  currency: string | null;
  defaultPriceEntryMode: string | null;
  defaultTaxRate: string | null;
};

export async function getSupplierOrganizationsForWorkspace({
  userId,
  workspaceId,
  searchQuery
}: {
  userId: string;
  workspaceId: string;
  searchQuery?: string;
}): Promise<SupplierSummary[]> {
  await authorizeWorkspacePermission({
    userId,
    workspaceId,
    permission: "purchase-orders:read"
  });

  const rows = await prisma.organization.findMany({
    where: {
      workspaceId,
      roles: { some: { role: ORGANIZATION_ROLE_SUPPLIER } },
      ...(searchQuery ? { name: { contains: searchQuery, mode: "insensitive" } } : {})
    },
    orderBy: { name: "asc" },
    take: searchQuery ? 20 : undefined,
    select: { id: true, name: true, currency: true, defaultPriceEntryMode: true, defaultTaxRate: true }
  });

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    currency: r.currency,
    defaultPriceEntryMode: r.defaultPriceEntryMode,
    defaultTaxRate: r.defaultTaxRate?.toString() ?? null
  }));
}

export async function getManufacturerSuggestionsForPartForm({
  userId,
  workspaceId
}: {
  userId: string;
  workspaceId: string;
}) {
  await authorizeWorkspacePermission({
    userId,
    workspaceId,
    permission: "parts:read"
  });

  return prisma.organization.findMany({
    where: {
      workspaceId,
      isInternal: false,
      roles: {
        some: {
          role: ORGANIZATION_ROLE_MANUFACTURER
        }
      }
    },
    orderBy: {
      name: "asc"
    },
    select: {
      id: true,
      name: true
    }
  });
}

export async function ensureInternalOrganizationForWorkspace({
  workspaceId,
  workspaceName
}: {
  workspaceId: string;
  workspaceName: string;
}): Promise<{ id: string }> {
  const existing = await prisma.organization.findFirst({
    where: { workspaceId, isInternal: true },
    select: { id: true }
  });
  if (existing) return existing;

  const displayName = workspaceName.trim().replace(/\s+/g, " ") || "Internal";
  const normalizedName = normalizeOrganizationName(displayName);

  const org = await prisma.organization.create({
    data: {
      workspaceId,
      name: displayName,
      normalizedName: `__internal__${normalizedName}`,
      isInternal: true,
      roles: { create: [{ role: ORGANIZATION_ROLE_MANUFACTURER }] }
    },
    select: { id: true }
  });

  return org;
}
