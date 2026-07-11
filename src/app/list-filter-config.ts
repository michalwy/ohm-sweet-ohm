"use client";

import type { Dispatch, SetStateAction } from "react";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";

// ─── Filter registration API ─────────────────────────────────────────────────

export type FilterControlProps<TValue = string> = {
  value: TValue;
  onChange: (value: TValue) => void;
  disabled?: boolean;
};

export type FilterDefinition<TValue = string> = {
  id: string;
  label: string;
  /** Drives which built-in chrome is used; "text" renders a plain text input, all others use renderControl. */
  type: "text" | "select" | "tree" | "numeric" | string;
  /** URL search-param key for this filter's value; omit to skip URL state. */
  urlParam?: string;
  /** When set, useFilterUrlState debounces the URL write by this many ms. */
  debounceMs?: number;
  /** When true the filter is always shown and excluded from the configure panel. */
  alwaysVisible?: boolean;
  /** Whether this filter appears by default when the user has never configured it. Defaults to true. */
  defaultVisible?: boolean;
  /** Render the interactive control. Required when type !== "text". */
  renderControl?: (props: FilterControlProps<TValue>) => React.ReactNode;
};

// ─── Stored configuration (localStorage) ─────────────────────────────────────

type StoredFilterConfiguration = {
  filterVisibility: Record<string, boolean>;
  filterOrder: string[];
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

type UseListFilterConfigurationInput = {
  storageKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: FilterDefinition<any>[];
};

export type UseListFilterConfigurationResult = {
  filterVisibility: Record<string, boolean>;
  filterOrder: string[];
  /** Filters that appear in the configure panel (non-alwaysVisible). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configurableFilters: FilterDefinition<any>[];
  setFilterVisible: (id: string, visible: boolean) => void;
  setFilterOrder: Dispatch<SetStateAction<string[]>>;
  resetFilterConfiguration: () => void;
  isLoaded: boolean;
};

export function useListFilterConfiguration({
  storageKey,
  filters
}: UseListFilterConfigurationInput): UseListFilterConfigurationResult {
  const defaults = useMemo(() => {
    const defaultOrder = filters.map((f) => f.id);
    const defaultVisibility = Object.fromEntries(
      filters.map((f) => [f.id, f.defaultVisible !== false])
    );
    return { filterOrder: defaultOrder, filterVisibility: defaultVisibility };
  }, [filters]);

  function getStoredState() {
    if (typeof window === "undefined") return defaults;

    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) return defaults;

    try {
      const parsed = JSON.parse(rawValue) as Partial<StoredFilterConfiguration>;
      const allowedIds = new Set(defaults.filterOrder);

      const parsedOrder = (parsed.filterOrder ?? []).filter((id) => allowedIds.has(id));
      const missingOrder = defaults.filterOrder.filter((id) => !parsedOrder.includes(id));
      const mergedOrder = [...parsedOrder, ...missingOrder];

      const mergedVisibility: Record<string, boolean> = { ...defaults.filterVisibility };
      Object.entries(parsed.filterVisibility ?? {}).forEach(([id, visible]) => {
        if (allowedIds.has(id)) mergedVisibility[id] = visible;
      });

      return { filterOrder: mergedOrder, filterVisibility: mergedVisibility };
    } catch {
      return defaults;
    }
  }

  const [isLoaded, setIsLoaded] = useState(false);
  const [filterVisibility, setFilterVisibility] = useState<Record<string, boolean>>(
    defaults.filterVisibility
  );
  const [filterOrder, setFilterOrder] = useState<string[]>(defaults.filterOrder);

  useLayoutEffect(() => {
    const nextState = getStoredState();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFilterVisibility(nextState.filterVisibility);
    setFilterOrder(nextState.filterOrder);
    setIsLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- storageKey is stable; including getStoredState would cause a loop
  }, [storageKey]);

  useEffect(() => {
    if (!isLoaded || typeof window === "undefined") return;

    const payload: StoredFilterConfiguration = { filterVisibility, filterOrder };
    window.localStorage.setItem(storageKey, JSON.stringify(payload));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isLoaded intentionally omitted: guard only, not a data dep
  }, [filterOrder, filterVisibility, storageKey]);

  function setFilterVisible(id: string, visible: boolean) {
    setFilterVisibility((current) => ({ ...current, [id]: visible }));
  }

  function resetFilterConfiguration() {
    setFilterVisibility(defaults.filterVisibility);
    setFilterOrder(defaults.filterOrder);
  }

  const configurableFilters = useMemo(
    () => filters.filter((f) => !f.alwaysVisible),
    [filters]
  );

  return {
    filterVisibility,
    filterOrder,
    configurableFilters,
    setFilterVisible,
    setFilterOrder,
    resetFilterConfiguration,
    isLoaded
  };
}
