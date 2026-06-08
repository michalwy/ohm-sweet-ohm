"use client";

import { useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";

import { useDebouncedValue } from "@/app/use-debounced-value";
import { getPartsListPageForWorkspace } from "@/server/parts/listActions";
import { ComboboxBase } from "@/app/combobox-base";

export type PartPickerOption = {
  id: string;
  catalogNumber: string;
  manufacturerName: string;
  description: string | null;
  primaryCategoryPath: string | null;
};

type PartPickerComboboxProps = {
  workspaceSlug: string;
  /** Text currently shown in the input (controlled by parent). */
  inputValue: string;
  /** Set when a part has been confirmed-selected; null means user is searching. */
  selectedPartId: string | null;
  placeholder: string;
  loadingLabel: string;
  noMatchesLabel: string;
  onInputChange: (value: string) => void;
  onSelect: (part: PartPickerOption) => void;
};

export function PartPickerCombobox({
  workspaceSlug,
  inputValue,
  selectedPartId,
  placeholder,
  loadingLabel,
  noMatchesLabel,
  onInputChange,
  onSelect,
}: PartPickerComboboxProps) {
  const inputId = useRef(`part-picker-${Math.random().toString(36).slice(2)}`).current;

  const debouncedInputValue = useDebouncedValue(inputValue, 300);
  const isDebouncing = inputValue.trim() !== debouncedInputValue.trim();
  const searchQuery = selectedPartId ? undefined : (debouncedInputValue.trim() || undefined);

  const partsQuery = useInfiniteQuery({
    queryKey: ["part-picker", workspaceSlug, searchQuery ?? ""],
    enabled: !selectedPartId && !isDebouncing && debouncedInputValue.trim().length > 0,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const result = await getPartsListPageForWorkspace({
        workspaceSlug,
        searchQuery,
        pageSize: 12,
        cursor: pageParam,
      });
      return result.ok
        ? result.page
        : { items: [], nextCursor: null, totalCount: 0, filteredCount: 0 };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const allParts = isDebouncing ? [] : (partsQuery.data?.pages.flatMap((p) => p.items) ?? []);

  return (
    <ComboboxBase
      inputId={inputId}
      inputValue={inputValue}
      placeholder={placeholder}
      openGate={!selectedPartId}
      items={allParts}
      isLoading={isDebouncing || partsQuery.isLoading || partsQuery.isFetchingNextPage}
      hasMore={partsQuery.hasNextPage}
      noItemsLabel={noMatchesLabel}
      loadingLabel={loadingLabel}
      positionMode="portal"
      renderItem={(part, isActive) => (
        <div
          className={`flex flex-col rounded-md px-3 py-2 text-sm transition ${
            isActive ? "bg-slate-100" : "hover:bg-slate-50"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900">{part.catalogNumber}</span>
            <span className="text-slate-500">{part.manufacturerName}</span>
          </div>
          {part.description ? (
            <p className="truncate text-xs text-slate-500">{part.description}</p>
          ) : null}
          {part.primaryCategoryPath ? (
            <p className="truncate text-xs text-slate-400">{part.primaryCategoryPath}</p>
          ) : null}
        </div>
      )}
      onInputChange={onInputChange}
      onItemSelect={(part) => onSelect(part)}
      onLoadMore={() => {
        if (partsQuery.hasNextPage && !partsQuery.isFetchingNextPage) {
          void partsQuery.fetchNextPage();
        }
      }}
    />
  );
}
