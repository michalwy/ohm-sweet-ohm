"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { Tooltip } from "@/app/floating";
import {
  parseStoredExpandedIds,
  serializeExpandedIds,
  toggleExpandedId
} from "@/app/tree-list-expansion";

// Shared primitives for the tree lists on management screens (part categories, storage
// locations): nested list structure, expand/collapse toggle, row chrome, row actions and
// persisted expansion state. Domain screens supply the row content and actions.

type TreeListItem<T> = { id: string; children: T[] };

export type TreeListToggleLabel = {
  /** Accessible name of the expand/collapse button. */
  label: string;
  /** Optional tooltip of the expand/collapse button. */
  title?: string;
};

export type TreeListRowContext = {
  level: number;
  /** The expand/collapse button, or a same-sized spacer for a leaf. */
  toggle: ReactNode;
};

export function TreeList<T extends TreeListItem<T>>({
  expandedIds,
  getToggleLabel,
  items,
  onToggleExpanded,
  renderRow
}: {
  expandedIds: ReadonlySet<string>;
  getToggleLabel: (item: T, isExpanded: boolean) => TreeListToggleLabel;
  items: T[];
  onToggleExpanded: (id: string) => void;
  renderRow: (item: T, context: TreeListRowContext) => ReactNode;
}) {
  return (
    <ol className="grid gap-1">
      {items.map((item) => (
        <TreeListNode
          key={item.id}
          expandedIds={expandedIds}
          getToggleLabel={getToggleLabel}
          item={item}
          level={0}
          onToggleExpanded={onToggleExpanded}
          renderRow={renderRow}
        />
      ))}
    </ol>
  );
}

function TreeListNode<T extends TreeListItem<T>>({
  expandedIds,
  getToggleLabel,
  item,
  level,
  onToggleExpanded,
  renderRow
}: {
  expandedIds: ReadonlySet<string>;
  getToggleLabel: (item: T, isExpanded: boolean) => TreeListToggleLabel;
  item: T;
  level: number;
  onToggleExpanded: (id: string) => void;
  renderRow: (item: T, context: TreeListRowContext) => ReactNode;
}) {
  const hasChildren = item.children.length > 0;
  const isExpanded = expandedIds.has(item.id);
  const toggle = hasChildren ? (
    <TreeListToggle
      isExpanded={isExpanded}
      label={getToggleLabel(item, isExpanded)}
      onToggle={() => onToggleExpanded(item.id)}
    />
  ) : (
    <span className="h-7 w-7" aria-hidden="true" />
  );

  return (
    <li className="grid gap-1">
      {renderRow(item, { level, toggle })}
      {hasChildren && isExpanded ? (
        <ol className="grid gap-1">
          {item.children.map((child) => (
            <TreeListNode
              key={child.id}
              expandedIds={expandedIds}
              getToggleLabel={getToggleLabel}
              item={child}
              level={level + 1}
              onToggleExpanded={onToggleExpanded}
              renderRow={renderRow}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function TreeListToggle({
  isExpanded,
  label,
  onToggle
}: {
  isExpanded: boolean;
  label: TreeListToggleLabel;
  onToggle: () => void;
}) {
  return (
    <button
      aria-expanded={isExpanded}
      aria-label={label.label}
      className="grid h-7 w-7 shrink-0 place-items-center rounded text-[var(--color-text-muted)] transition hover:bg-[var(--color-bg-elevated)]/70 hover:text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2"
      title={label.title}
      type="button"
      onClick={(event) => {
        // Rows may be clickable; toggling must not also activate the row.
        event.stopPropagation();
        onToggle();
      }}
    >
      <span
        aria-hidden="true"
        className={`text-sm leading-none transition-transform ${isExpanded ? "rotate-90" : ""}`}
      >
        ▶
      </span>
    </button>
  );
}

/**
 * Colour of a tree row: assignable rows are light with a darker border, organizational ones
 * muted; a selected row is highlighted; an interactive row gets a pointer and hover state.
 */
export function getTreeListRowToneClassName({
  isAssignable,
  isInteractive = false,
  isSelected = false
}: {
  isAssignable: boolean;
  isInteractive?: boolean;
  isSelected?: boolean;
}) {
  return [
    isAssignable
      ? "border-[var(--color-border-hover)] text-[var(--color-text-primary)]"
      : "border-[var(--color-border-strong)] text-[var(--color-text-secondary)]",
    isSelected
      ? "bg-[var(--color-bg-muted)]"
      : isAssignable
        ? "bg-[var(--color-bg-elevated)]"
        : "bg-[var(--color-bg-subtle)]",
    isInteractive ? "cursor-pointer hover:bg-[var(--color-bg-muted)]" : ""
  ].join(" ");
}

export function TreeListRow({
  actions,
  children,
  className,
  context,
  style,
  ...rowAttributes
}: {
  actions: ReactNode;
  children: ReactNode;
  /** Tone classes, usually from `getTreeListRowToneClassName`. */
  className: string;
  context: TreeListRowContext;
} & Omit<HTMLAttributes<HTMLDivElement>, "children" | "className">) {
  return (
    <div
      {...rowAttributes}
      className={`grid min-h-12 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border-l-4 px-3 py-2 ${className}`}
      style={{ ...style, marginLeft: `${context.level * 1.25}rem` }}
    >
      {context.toggle}
      <div className="min-w-0">{children}</div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </div>
  );
}

const secondaryActionClassName =
  "min-h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]";
const destructiveActionClassName =
  "min-h-9 rounded-md border border-[var(--color-error-border)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]";

/** The standard row actions: add a child, edit, delete. Clicks do not reach the row. */
export function TreeListRowActions({
  addChildLabel,
  deleteLabel,
  disabled,
  editLabel,
  onAddChild,
  onDelete,
  onEdit
}: {
  addChildLabel: string;
  deleteLabel: string;
  disabled: boolean;
  editLabel: string;
  onAddChild: () => void;
  onDelete: () => void;
  onEdit: () => void;
}) {
  return (
    <>
      <button
        className={secondaryActionClassName}
        disabled={disabled}
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onAddChild();
        }}
      >
        {addChildLabel}
      </button>
      <Tooltip label={editLabel}>
        <button
          className={secondaryActionClassName}
          aria-label={editLabel}
          disabled={disabled}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13.9 3.3a1.5 1.5 0 0 1 2.1 0l.7.7a1.5 1.5 0 0 1 0 2.1l-8.4 8.4-3.3.8.8-3.3 8.4-8.4Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </Tooltip>
      <Tooltip label={deleteLabel}>
        <button
          className={destructiveActionClassName}
          aria-label={deleteLabel}
          disabled={disabled}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4"
            viewBox="0 0 20 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M5.5 6h9m-7.5 0V4.75A1.75 1.75 0 0 1 8.75 3h2.5A1.75 1.75 0 0 1 13 4.75V6m-6.5 0 .6 9.1A1.75 1.75 0 0 0 8.84 16.75h2.32a1.75 1.75 0 0 0 1.74-1.65L13.5 6M8.75 8.5v5m2.5-5v5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </Tooltip>
    </>
  );
}

/**
 * Expansion state persisted in localStorage under `storageKey`. The first render uses
 * `defaultExpandedIds` (localStorage is not available during server rendering); the stored
 * state is applied on the next frame unless the user has already toggled a row.
 * `changeEventName`, when given, is dispatched on `window` after each save.
 */
export function usePersistedTreeExpansion({
  changeEventName,
  defaultExpandedIds,
  storageKey
}: {
  changeEventName?: string;
  defaultExpandedIds: Set<string>;
  storageKey: string;
}) {
  const interactedRef = useRef(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(defaultExpandedIds);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      if (interactedRef.current) {
        return;
      }

      setExpandedIds(
        parseStoredExpandedIds(readStoredValue(storageKey), defaultExpandedIds)
      );
    });
  }, [storageKey, defaultExpandedIds]);

  /** Saves `ids` without changing what is rendered now. */
  const persist = useCallback(
    (ids: ReadonlySet<string>) => saveStoredValue(storageKey, ids, changeEventName),
    [storageKey, changeEventName]
  );

  /** Expands `id` and saves the result. */
  const expand = useCallback(
    (id: string) => {
      setExpandedIds((currentIds) => {
        const nextIds = new Set(currentIds);
        nextIds.add(id);
        persist(nextIds);
        return nextIds;
      });
    },
    [persist]
  );

  /** A user toggle: flips `id`, saves, and stops the stored state from overriding it. */
  const toggle = useCallback(
    (id: string) => {
      interactedRef.current = true;
      const nextIds = toggleExpandedId(expandedIds, id);
      persist(nextIds);
      setExpandedIds(nextIds);
    },
    [expandedIds, persist]
  );

  return { expand, expandedIds, persist, toggle };
}

function readStoredValue(storageKey: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(storageKey);
}

function saveStoredValue(
  storageKey: string,
  expandedIds: ReadonlySet<string>,
  changeEventName: string | undefined
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, serializeExpandedIds(expandedIds));
    if (changeEventName) {
      window.dispatchEvent(new Event(changeEventName));
    }
  } catch {
    // Ignore unavailable local storage; the tree still works for this page load.
  }
}
