"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { ComboboxBase } from "@/app/combobox-base";
import { searchSupplierOrganizationsForWorkspace } from "@/server/purchase-orders/purchaseOrderActions";

type SupplierOption = {
  id: string;
  name: string;
  currency: string | null;
  defaultPriceEntryMode: string | null;
  defaultTaxRate: string | null;
};

type SupplierPickerComboboxProps = {
  workspaceSlug: string;
  inputId: string;
  placeholder: string;
  noItemsLabel: string;
  loadingLabel: string;
  initialValue?: { id: string; name: string } | null;
  disabled?: boolean;
  onSupplierSelect?: (supplier: SupplierOption) => void;
};

export function SupplierPickerCombobox({
  workspaceSlug,
  inputId,
  placeholder,
  noItemsLabel,
  loadingLabel,
  initialValue,
  disabled,
  onSupplierSelect,
}: SupplierPickerComboboxProps) {
  const [inputValue, setInputValue] = useState(initialValue?.name ?? "");
  const [selectedId, setSelectedId] = useState(initialValue?.id ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isDebouncing, setIsDebouncing] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue(initialValue?.name ?? "");
    setSelectedId(initialValue?.id ?? "");
  }, [initialValue?.id, initialValue?.name]);

  function scheduleDebounce(value: string) {
    setIsDebouncing(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(value);
      setIsDebouncing(false);
    }, 300);
  }

  const { data, isFetching } = useQuery({
    queryKey: ["supplier-search", workspaceSlug, debouncedQuery],
    queryFn: async () => {
      const result = await searchSupplierOrganizationsForWorkspace({
        workspaceSlug,
        searchQuery: debouncedQuery || undefined
      });
      return result.ok ? result.data : [];
    },
    staleTime: 30_000,
  });

  const items: SupplierOption[] = isDebouncing ? [] : (data ?? []);

  return (
    <div className="relative">
      <input type="hidden" name="supplierId" value={selectedId} />
      <ComboboxBase
        inputId={inputId}
        inputValue={inputValue}
        placeholder={placeholder}
        disabled={disabled}
        openGate={!selectedId}
        isLoading={isDebouncing || isFetching}
        noItemsLabel={noItemsLabel}
        loadingLabel={loadingLabel}
        items={items}
        renderItem={(item, isActive) => (
          <div
            className={`min-h-9 w-full rounded-md px-3 py-1.5 text-left text-sm transition ${
              isActive
                ? "bg-[var(--color-accent-soft)] font-semibold text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
            }`}
          >
            {item.name}
          </div>
        )}
        onInputChange={(next) => {
          setInputValue(next);
          setSelectedId("");
          scheduleDebounce(next);
        }}
        onItemSelect={(item) => {
          setInputValue(item.name);
          setSelectedId(item.id);
          onSupplierSelect?.(item);
        }}
      />
    </div>
  );
}
