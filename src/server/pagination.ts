import "server-only";

import { DEFAULT_LIST_PAGE_SIZE, MAX_LIST_PAGE_SIZE } from "@/server/paginationLimits";

export { DEFAULT_LIST_PAGE_SIZE, MAX_LIST_PAGE_SIZE };

export type ListPage<TItem> = {
  items: TItem[];
  nextCursor: string | null;
  totalCount: number;
  filteredCount: number;
};

export function getListPageSize(pageSize?: number | null) {
  if (!pageSize || !Number.isFinite(pageSize)) {
    return DEFAULT_LIST_PAGE_SIZE;
  }

  return Math.max(1, Math.min(Math.floor(pageSize), MAX_LIST_PAGE_SIZE));
}

export function encodeListCursor<TCursor>(cursor: TCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeListCursor<TCursor>(cursor: string | null | undefined) {
  if (!cursor) {
    return null;
  }

  try {
    return JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as TCursor;
  } catch {
    return null;
  }
}
