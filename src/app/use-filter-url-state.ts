"use client";

import { useEffect, useRef, useState } from "react";

import type { FilterDefinition } from "@/app/list-filter-config";
import { useDebouncedValue } from "@/app/use-debounced-value";

export type FilterValues = Record<string, string>;

export type UseFilterUrlStateResult = {
  filterValues: FilterValues;
  setFilterValue: (id: string, value: string) => void;
  clearFilterValues: () => void;
  hasActiveFilters: boolean;
};

function readUrlValues(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: FilterDefinition<any>[]
): FilterValues {
  if (typeof window === "undefined") return {};

  const params = new URLSearchParams(window.location.search);
  return Object.fromEntries(
    filters
      .filter((f) => f.urlParam)
      .map((f) => [f.id, params.get(f.urlParam!) ?? ""])
  );
}

function syncUrl(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: FilterDefinition<any>[],
  values: FilterValues
) {
  if (typeof window === "undefined") return;

  const url = new URL(window.location.href);
  for (const filter of filters) {
    if (!filter.urlParam) continue;
    const value = values[filter.id] ?? "";
    if (value) {
      url.searchParams.set(filter.urlParam, value);
    } else {
      url.searchParams.delete(filter.urlParam);
    }
  }
  window.history.replaceState(window.history.state, "", url.toString());
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useFilterUrlState(filters: FilterDefinition<any>[]): UseFilterUrlStateResult {
  const [filterValues, setFilterValues] = useState<FilterValues>(() =>
    readUrlValues(filters)
  );

  // Collect per-filter debounced values for URL writes.
  // Each filter may declare a debounceMs; we track all of them in refs.
  // Rather than a variable number of hooks, we debounce the whole values object
  // at the slowest declared debounceMs across all filters, and write to URL
  // whenever the debounced snapshot changes.
  const maxDebounceMs = filters.reduce(
    (max, f) => Math.max(max, f.debounceMs ?? 0),
    0
  );
  const debouncedValues = useDebouncedValue(filterValues, maxDebounceMs);

  const isInitialMount = useRef(true);

  useEffect(() => {
    // Skip the URL write on the very first render (values were just read from URL).
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    syncUrl(filters, debouncedValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- filters is stable; debouncedValues triggers the actual sync
  }, [debouncedValues]);

  function setFilterValue(id: string, value: string) {
    setFilterValues((current) => ({ ...current, [id]: value }));
  }

  function clearFilterValues() {
    const cleared = Object.fromEntries(Object.keys(filterValues).map((id) => [id, ""]));
    setFilterValues(cleared);
    // Write cleared values to URL immediately (no debounce for clear).
    syncUrl(filters, cleared);
  }

  const hasActiveFilters = Object.values(filterValues).some((v) => v.trim() !== "");

  return { filterValues, setFilterValue, clearFilterValues, hasActiveFilters };
}
