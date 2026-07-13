import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { authorizeWorkspacePermission } from "@/server/access-control/authorize";
import { prisma } from "@/server/db/prisma";
import { deserializeDateRangeFilter, dateRangeToUtcBounds } from "@/app/date-range-filter-value";
import {
  decodeListCursor,
  encodeListCursor,
  getListPageSize,
  type ListPage
} from "@/server/pagination";
import { ensureInternalOrganizationForWorkspace } from "@/server/organizations/organizations";

export type DesignRevisionSummary = {
  id: string;
  revisionNumber: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DesignSummary = {
  id: string;
  name: string;
  description: string | null;
  outputPart: {
    id: string;
    catalogNumber: string;
    currentStock: string;
  };
  revisionCount: number;
  latestRevisionNumber: number | null;
  createdAt: Date;
  updatedAt: Date;
};

export type DesignDetail = DesignSummary & {
  revisions: DesignRevisionSummary[];
};

export type DesignSortBy = "name" | "catalogNumber" | "createdAt";

type DesignCursor = { key: string; id: string };

export async function getNextDesignCatalogNumber(workspaceId: string): Promise<string> {
  const count = await prisma.design.count({ where: { workspaceId } });
  return `DESIGN-${String(count + 1).padStart(4, "0")}`;
}

export async function getDesignsForWorkspace({
  userId,
  workspaceId,
  cursor,
  pageSize,
  sortBy = "name",
  sortDir = "asc",
  searchQuery,
  createdAtFilter
}: {
  userId: string;
  workspaceId: string;
  cursor?: string | null;
  pageSize?: number | null;
  sortBy?: DesignSortBy;
  sortDir?: "asc" | "desc";
  searchQuery?: string | null;
  createdAtFilter?: string | null;
}): Promise<ListPage<DesignSummary>> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "designs:read" });

  const limit = getListPageSize(pageSize);
  const baseWhere: Prisma.DesignWhereInput = { workspaceId };
  const totalCount = await prisma.design.count({ where: baseWhere });

  const whereClauses: Prisma.DesignWhereInput[] = [baseWhere];
  if (searchQuery) {
    whereClauses.push({
      OR: [
        { name: { contains: searchQuery, mode: "insensitive" } },
        { description: { contains: searchQuery, mode: "insensitive" } },
        { outputPart: { catalogNumber: { contains: searchQuery, mode: "insensitive" } } }
      ]
    });
  }
  if (createdAtFilter) {
    const parsed = deserializeDateRangeFilter(createdAtFilter);
    if (parsed) whereClauses.push({ createdAt: dateRangeToUtcBounds(parsed) });
  }
  const filteredWhere: Prisma.DesignWhereInput =
    whereClauses.length > 1 ? { AND: whereClauses } : baseWhere;
  const hasFilters = whereClauses.length > 1;

  const filteredCount = hasFilters
    ? await prisma.design.count({ where: filteredWhere })
    : totalCount;

  const decoded = decodeListCursor<DesignCursor>(cursor);
  const dir = sortDir === "asc" ? "asc" : "desc";
  const asc = dir === "asc";

  const orderBy: Prisma.DesignOrderByWithRelationInput[] =
    sortBy === "catalogNumber"
      ? [{ outputPart: { catalogNumber: dir } }, { id: dir }]
      : sortBy === "createdAt"
        ? [{ createdAt: dir }, { id: dir }]
        : [{ name: dir }, { id: dir }];

  function cursorWhere(c: DesignCursor): Prisma.DesignWhereInput {
    if (sortBy === "catalogNumber") {
      return {
        OR: [
          { outputPart: { catalogNumber: asc ? { gt: c.key } : { lt: c.key } } },
          { outputPart: { catalogNumber: c.key }, id: asc ? { gt: c.id } : { lt: c.id } }
        ]
      };
    }
    if (sortBy === "createdAt") {
      const at = new Date(c.key);
      return {
        OR: [
          { createdAt: asc ? { gt: at } : { lt: at } },
          { createdAt: at, id: asc ? { gt: c.id } : { lt: c.id } }
        ]
      };
    }
    return {
      OR: [
        { name: asc ? { gt: c.key } : { lt: c.key } },
        { name: c.key, id: asc ? { gt: c.id } : { lt: c.id } }
      ]
    };
  }

  const rows = await prisma.design.findMany({
    where: decoded ? { AND: [filteredWhere, cursorWhere(decoded)] } : filteredWhere,
    orderBy,
    take: limit + 1,
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      outputPart: {
        select: {
          id: true,
          catalogNumber: true,
          currentStock: true
        }
      },
      _count: { select: { revisions: true } },
      revisions: {
        orderBy: { revisionNumber: "desc" },
        take: 1,
        select: { revisionNumber: true }
      }
    }
  });

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    outputPart: {
      id: r.outputPart.id,
      catalogNumber: r.outputPart.catalogNumber,
      currentStock: r.outputPart.currentStock.toString()
    },
    revisionCount: r._count.revisions,
    latestRevisionNumber: r.revisions[0]?.revisionNumber ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt
  }));

  const last = items[items.length - 1];
  const lastKey = last
    ? sortBy === "catalogNumber"
      ? last.outputPart.catalogNumber
      : sortBy === "createdAt"
        ? last.createdAt.toISOString()
        : last.name
    : "";
  const nextCursor =
    hasMore && last
      ? encodeListCursor<DesignCursor>({ key: lastKey, id: last.id })
      : null;

  return { items, nextCursor, totalCount, filteredCount };
}

export async function getDesignDetail({
  userId,
  workspaceId,
  designId
}: {
  userId: string;
  workspaceId: string;
  designId: string;
}): Promise<DesignDetail | null> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "designs:read" });

  const row = await prisma.design.findUnique({
    where: { id: designId },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      outputPart: {
        select: { id: true, catalogNumber: true, currentStock: true }
      },
      _count: { select: { revisions: true } },
      revisions: {
        orderBy: { revisionNumber: "asc" },
        select: {
          id: true,
          revisionNumber: true,
          notes: true,
          createdAt: true,
          updatedAt: true
        }
      }
    }
  });

  if (!row || row.outputPart === null) return null;

  // Verify ownership
  const design = await prisma.design.findFirst({
    where: { id: designId, workspaceId },
    select: { id: true }
  });
  if (!design) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    outputPart: {
      id: row.outputPart.id,
      catalogNumber: row.outputPart.catalogNumber,
      currentStock: row.outputPart.currentStock.toString()
    },
    revisionCount: row._count.revisions,
    latestRevisionNumber: row.revisions[row.revisions.length - 1]?.revisionNumber ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    revisions: row.revisions.map((rev) => ({
      id: rev.id,
      revisionNumber: rev.revisionNumber,
      notes: rev.notes,
      createdAt: rev.createdAt,
      updatedAt: rev.updatedAt
    }))
  };
}

export async function createDesign({
  userId,
  workspaceId,
  workspaceName,
  name,
  description,
  catalogNumber,
  unitId
}: {
  userId: string;
  workspaceId: string;
  workspaceName: string;
  name: string;
  description?: string | null;
  catalogNumber: string;
  unitId: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "designs:write" });

  if (!name.trim()) return { ok: false, error: "name_required" };
  if (!catalogNumber.trim()) return { ok: false, error: "catalog_number_required" };

  const internalOrg = await ensureInternalOrganizationForWorkspace({ workspaceId, workspaceName });

  const catalogNumberTrimmed = catalogNumber.trim();

  const existingPart = await prisma.part.findUnique({
    where: {
      workspaceId_manufacturerId_catalogNumber: {
        workspaceId,
        manufacturerId: internalOrg.id,
        catalogNumber: catalogNumberTrimmed
      }
    },
    select: { id: true }
  });
  if (existingPart) return { ok: false, error: "catalog_number_taken" };

  const design = await prisma.$transaction(async (tx) => {
    const part = await tx.part.create({
      data: {
        workspaceId,
        manufacturerId: internalOrg.id,
        catalogNumber: catalogNumberTrimmed,
        description: description?.trim() || name.trim(),
        unitId
      },
      select: { id: true }
    });

    const createdDesign = await tx.design.create({
      data: {
        workspaceId,
        name: name.trim(),
        description: description?.trim() || null,
        outputPartId: part.id,
        revisions: {
          create: [{ workspaceId, revisionNumber: 1 }]
        }
      },
      select: { id: true }
    });

    return createdDesign;
  });

  return { ok: true, id: design.id };
}

export async function updateDesign({
  userId,
  workspaceId,
  designId,
  name,
  description
}: {
  userId: string;
  workspaceId: string;
  designId: string;
  name: string;
  description?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "designs:write" });

  if (!name.trim()) return { ok: false, error: "name_required" };

  const existing = await prisma.design.findFirst({
    where: { id: designId, workspaceId },
    select: { id: true }
  });
  if (!existing) return { ok: false, error: "not_found" };

  await prisma.design.update({
    where: { id: designId },
    data: { name: name.trim(), description: description?.trim() || null }
  });

  return { ok: true };
}

export async function deleteDesign({
  userId,
  workspaceId,
  designId
}: {
  userId: string;
  workspaceId: string;
  designId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "designs:write" });

  const design = await prisma.design.findFirst({
    where: { id: designId, workspaceId },
    select: {
      id: true,
      outputPartId: true,
      outputPart: {
        select: {
          currentStock: true,
          _count: { select: { inventoryEntries: true } }
        }
      }
    }
  });
  if (!design) return { ok: false, error: "not_found" };

  if (!design.outputPart.currentStock.isZero()) {
    return { ok: false, error: "output_part_has_stock" };
  }
  if (design.outputPart._count.inventoryEntries > 0) {
    return { ok: false, error: "output_part_has_inventory_history" };
  }

  await prisma.$transaction(async (tx) => {
    await tx.design.delete({ where: { id: designId } });
    await tx.part.delete({ where: { id: design.outputPartId } });
  });

  return { ok: true };
}

export async function addRevisionToDesign({
  userId,
  workspaceId,
  designId,
  notes
}: {
  userId: string;
  workspaceId: string;
  designId: string;
  notes?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "designs:write" });

  const design = await prisma.design.findFirst({
    where: { id: designId, workspaceId },
    select: {
      id: true,
      revisions: {
        orderBy: { revisionNumber: "desc" },
        take: 1,
        select: { revisionNumber: true }
      }
    }
  });
  if (!design) return { ok: false, error: "not_found" };

  const nextRevisionNumber = (design.revisions[0]?.revisionNumber ?? 0) + 1;

  const revision = await prisma.designRevision.create({
    data: {
      designId,
      workspaceId,
      revisionNumber: nextRevisionNumber,
      notes: notes?.trim() || null
    },
    select: { id: true }
  });

  return { ok: true, id: revision.id };
}

export async function updateDesignRevision({
  userId,
  workspaceId,
  revisionId,
  notes
}: {
  userId: string;
  workspaceId: string;
  revisionId: string;
  notes: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await authorizeWorkspacePermission({ userId, workspaceId, permission: "designs:write" });

  const revision = await prisma.designRevision.findFirst({
    where: { id: revisionId, workspaceId },
    select: { id: true }
  });
  if (!revision) return { ok: false, error: "not_found" };

  await prisma.designRevision.update({
    where: { id: revisionId },
    data: { notes: notes?.trim() || null }
  });

  return { ok: true };
}
