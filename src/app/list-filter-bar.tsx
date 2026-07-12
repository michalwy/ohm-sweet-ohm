"use client";

import type { Dispatch, SetStateAction } from "react";
import { useRef, useMemo, useState } from "react";

import type { FilterDefinition } from "@/app/list-filter-config";
import type { FilterValues } from "@/app/use-filter-url-state";
import { NumericFilterControl } from "@/app/numeric-filter-control";
import { DateRangeFilterControl } from "@/app/date-range-filter-control";
import { BooleanFilterControl } from "@/app/boolean-filter-control";
import {
  DialogBody,
  DialogFooter,
  DialogSecondaryButton,
  DialogShell,
  closeDialog,
  openDialog
} from "@/app/dialog-shell";

type FilterBarProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filters: FilterDefinition<any>[];
  filterVisibility: Record<string, boolean>;
  filterOrder: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  configurableFilters: FilterDefinition<any>[];
  setFilterVisible: (id: string, visible: boolean) => void;
  setFilterOrder: Dispatch<SetStateAction<string[]>>;
  filterValues: FilterValues;
  onFilterChange: (id: string, value: string) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  disabled?: boolean;
  configureFiltersLabel: string;
  clearFiltersLabel: string;
  availableFiltersLabel: string;
};

export function FilterBar({
  filters,
  filterVisibility,
  filterOrder,
  configurableFilters,
  setFilterVisible,
  setFilterOrder,
  filterValues,
  onFilterChange,
  onClearFilters,
  hasActiveFilters,
  disabled = false,
  configureFiltersLabel,
  clearFiltersLabel,
  availableFiltersLabel
}: FilterBarProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const filterById = useMemo(
    () => new Map(filters.map((f) => [f.id, f])),
    [filters]
  );

  // Build the list of visible filters in display order.
  const visibleFilters = useMemo(() => {
    const ordered: FilterDefinition[] = [];
    // alwaysVisible filters come first (in definition order)
    for (const f of filters) {
      if (f.alwaysVisible) ordered.push(f);
    }
    // then configurable filters in persisted order
    for (const id of filterOrder) {
      const f = filterById.get(id);
      if (!f || f.alwaysVisible) continue;
      if (filterVisibility[id] !== false) ordered.push(f);
    }
    return ordered;
  }, [filters, filterOrder, filterVisibility, filterById]);

  // Configurable filters ordered by filterOrder (for the modal list).
  const orderedConfigurableFilters = useMemo(() => {
    const configurableById = new Map(configurableFilters.map((f) => [f.id, f]));
    const ordered: FilterDefinition[] = [];
    for (const id of filterOrder) {
      const f = configurableById.get(id);
      if (f) ordered.push(f);
    }
    // Append any that aren't in filterOrder yet (new filters added after initial load).
    for (const f of configurableFilters) {
      if (!ordered.includes(f)) ordered.push(f);
    }
    return ordered;
  }, [configurableFilters, filterOrder]);

  // Drag-and-drop reorder within the modal list.
  const [draggedFilterId, setDraggedFilterId] = useState<string | null>(null);

  function handleDragStart(id: string) {
    setDraggedFilterId(id);
  }

  function handleDropOnto(targetId: string) {
    if (!draggedFilterId || draggedFilterId === targetId) return;
    setFilterOrder((current) => {
      const sourceIndex = current.indexOf(draggedFilterId);
      const targetIndex = current.indexOf(targetId);
      if (sourceIndex < 0 || targetIndex < 0) return current;
      const next = [...current];
      const [item] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }

  function handleDragEnd() {
    setDraggedFilterId(null);
  }

  return (
    <div className="flex items-end gap-3">
      {visibleFilters.map((filter) => (
        <FilterControl
          key={filter.id}
          filter={filter}
          value={filterValues[filter.id] ?? ""}
          onChange={(value) => onFilterChange(filter.id, value)}
          disabled={disabled}
        />
      ))}

      {hasActiveFilters ? (
        <button
          className="min-h-9 text-sm font-medium text-[var(--color-accent)] hover:underline focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] focus:ring-offset-2"
          type="button"
          onClick={onClearFilters}
        >
          {clearFiltersLabel}
        </button>
      ) : null}

      {configurableFilters.length > 0 ? (
        <>
          <button
            className="min-h-9 self-end rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2"
            type="button"
            onClick={() => openDialog(dialogRef.current)}
          >
            {configureFiltersLabel}
          </button>

          <DialogShell
            ref={dialogRef}
            closeLabel="Close"
            title={availableFiltersLabel}
            titleId="configure-filters-title"
            widthClassName="w-[min(24rem,calc(100vw-3rem))]"
            onCancel={(e) => { e.preventDefault(); closeDialog(dialogRef.current); }}
            onCloseClick={() => closeDialog(dialogRef.current)}
          >
            <DialogBody>
              <ul className="grid gap-2" role="list">
                {orderedConfigurableFilters.map((filter) => {
                  const isVisible = filterVisibility[filter.id] !== false;
                  const isDragging = draggedFilterId === filter.id;

                  return (
                    <li
                      key={filter.id}
                      draggable
                      className={`flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2 text-sm transition${isDragging ? " opacity-40" : " hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-elevated)]"}`}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => {
                        if (draggedFilterId != null) e.preventDefault();
                      }}
                      onDragStart={() => handleDragStart(filter.id)}
                      onDrop={() => handleDropOnto(filter.id)}
                    >
                      {/* Drag grip */}
                      <span
                        aria-hidden
                        className="flex-shrink-0 cursor-grab select-none text-base leading-none text-[var(--color-text-placeholder)]"
                      >
                        ⠿
                      </span>
                      <label className="inline-flex flex-1 cursor-pointer items-center gap-2 text-[var(--color-text-secondary)]">
                        <input
                          checked={isVisible}
                          type="checkbox"
                          onChange={(e) => setFilterVisible(filter.id, e.currentTarget.checked)}
                        />
                        <span>{filter.label}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </DialogBody>
            <DialogFooter>
              <DialogSecondaryButton onClick={() => closeDialog(dialogRef.current)}>
                Close
              </DialogSecondaryButton>
            </DialogFooter>
          </DialogShell>
        </>
      ) : null}
    </div>
  );
}

// ─── Per-filter control ────────────────────────────────────────────────────────

type FilterControlProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  filter: FilterDefinition<any>;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
};

function FilterControl({ filter, value, onChange, disabled }: FilterControlProps) {
  if (filter.type === "text") {
    return (
      <label className="grid min-w-72 gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
        {filter.label}
        <input
          className="min-h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-placeholder)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
          disabled={disabled}
          type="search"
          value={value}
          onChange={(e) => onChange(e.currentTarget.value)}
        />
      </label>
    );
  }

  if (filter.type === "numeric") {
    return (
      <NumericFilterControl
        baseUnitSymbol={filter.baseUnitSymbol}
        disabled={disabled}
        label={filter.label}
        value={value}
        onChange={onChange}
      />
    );
  }

  if (filter.type === "date-range") {
    return (
      <DateRangeFilterControl
        disabled={disabled}
        label={filter.label}
        value={value}
        onChange={onChange}
      />
    );
  }

  if (filter.type === "boolean") {
    return (
      <BooleanFilterControl
        disabled={disabled}
        label={filter.label}
        value={value}
        onChange={onChange}
      />
    );
  }

  if (filter.type === "choice") {
    return (
      <ChoiceFilterControl
        choiceOptions={filter.choiceOptions ?? []}
        disabled={disabled}
        label={filter.label}
        value={value}
        onChange={onChange}
      />
    );
  }

  if (filter.renderControl) {
    return <>{filter.renderControl({ value, onChange, disabled })}</>;
  }

  return null;
}

// ─── Choice filter control ────────────────────────────────────────────────────

type ChoiceFilterControlProps = {
  choiceOptions: Array<{ id: string; label: string }>;
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
};

function ChoiceFilterControl({
  choiceOptions,
  label,
  value,
  onChange,
  disabled
}: ChoiceFilterControlProps) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
      {label}
      <select
        className="min-h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
      >
        <option value="">All</option>
        <option value="__none__">No value</option>
        {choiceOptions.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}
