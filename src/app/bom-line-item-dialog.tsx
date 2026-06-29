"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  DialogActions,
  DialogBody,
  DialogShell,
  LabelWithError,
  closeDialog,
  openDialog
} from "@/app/dialog-shell";
import { PartPickerCombobox } from "@/app/part-picker-combobox";
import { CategoryTreeSelect, buildCategoryTree } from "@/app/parts-category-tree-select";
import { useDebouncedValue } from "@/app/use-debounced-value";
import { parseDesignatorRange } from "@/lib/designators";
import {
  MATCHER_OPERATORS_BY_TYPE,
  type MatcherOperator
} from "@/server/designs/bomMatcherEvaluation";
import {
  getBomCategoryAttributesAction,
  getBomDialogDataAction,
  previewLineItemMatchesAction,
  type BomDialogData,
  type BomLineItemInput,
  type BomLineItemSummary
} from "@/server/designs/bomActions";
import type { AttributeListItem } from "@/server/parts/attributeMutations";

const inputClassName =
  "w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-placeholder)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]";

const OPERATOR_LABELS: Record<MatcherOperator, string> = {
  EQ: "=",
  NEQ: "≠",
  LT: "<",
  LTE: "≤",
  GT: ">",
  GTE: "≥"
};

const labels = {
  newTitle: "Add BOM line item",
  editTitle: "Edit BOM line item",
  close: "Close",
  designators: "Designators",
  designatorsPlaceholder: "e.g. R1, R3, R5-R10",
  quantity: "Quantity",
  category: "Category (optional)",
  noCategory: "Any category",
  pinnedPart: "Pinned part (optional)",
  pinnedPartPlaceholder: "Search a part to pin…",
  clearPinnedPart: "Clear",
  pinnedPartHint: "When a part is pinned, attribute matchers are ignored.",
  partLoading: "Searching…",
  partNoMatches: "No matching parts",
  matchers: "Attribute matchers",
  matchersNeedCategory: "Select a category to add attribute matchers.",
  addMatcher: "Add matcher",
  selectAttribute: "Attribute…",
  attributeColumn: "Attribute",
  operatorColumn: "Op",
  valueColumn: "Value",
  removeMatcher: "Remove",
  valuePlaceholder: "Value",
  booleanYes: "Yes",
  booleanNo: "No",
  preview: "Matching parts",
  previewEmpty: "No parts match this spec yet.",
  previewMore: (count: number) => `+${count} more not shown`,
  partCatalogColumn: "Catalog number",
  partManufacturerColumn: "Manufacturer",
  partDescriptionColumn: "Description",
  notes: "Notes (optional)",
  save: "Save",
  create: "Add line item",
  searchCategories: "Search categories…",
  noMatchingCategories: "No matching categories",
  expandCategory: "Expand",
  collapseCategory: "Collapse"
};

type MatcherRow = {
  key: string;
  attributeId: string;
  operator: MatcherOperator;
  rawValue: string;
};

type BomLineItemDialogProps = {
  workspaceSlug: string;
  open: boolean;
  /** Increments on every open so the inner form remounts with fresh state. */
  instanceKey: number;
  editing: BomLineItemSummary | null;
  isSaving: boolean;
  saveError: string | null;
  onClose: () => void;
  onSubmit: (input: BomLineItemInput) => void;
};

let matcherKeySeed = 0;
function nextMatcherKey() {
  matcherKeySeed += 1;
  return `m${matcherKeySeed}`;
}

export function BomLineItemDialog({
  workspaceSlug,
  open,
  instanceKey,
  editing,
  isSaving,
  saveError,
  onClose,
  onSubmit
}: BomLineItemDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Drive the native dialog element from the `open` prop (no React state changes here).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) openDialog(dialog);
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <DialogShell
      ref={dialogRef}
      title={editing ? labels.editTitle : labels.newTitle}
      titleId="bom-line-item-dialog-title"
      closeLabel={labels.close}
      onClose={onClose}
      onCloseClick={() => closeDialog(dialogRef.current)}
    >
      <LineItemForm
        key={instanceKey}
        workspaceSlug={workspaceSlug}
        editing={editing}
        isSaving={isSaving}
        saveError={saveError}
        onClose={onClose}
        onSubmit={onSubmit}
      />
    </DialogShell>
  );
}

type LineItemFormProps = {
  workspaceSlug: string;
  editing: BomLineItemSummary | null;
  isSaving: boolean;
  saveError: string | null;
  onClose: () => void;
  onSubmit: (input: BomLineItemInput) => void;
};

function LineItemForm({
  workspaceSlug,
  editing,
  isSaving,
  saveError,
  onClose,
  onSubmit
}: LineItemFormProps) {
  const [designators, setDesignators] = useState(editing?.designators ?? "");
  const [categoryId, setCategoryId] = useState(editing?.category?.id ?? "");
  const [pinnedPartId, setPinnedPartId] = useState<string | null>(editing?.pinnedPart?.id ?? null);
  const [pinnedPartInput, setPinnedPartInput] = useState(editing?.pinnedPart?.catalogNumber ?? "");
  const [matchers, setMatchers] = useState<MatcherRow[]>(
    (editing?.matchers ?? []).map((matcher) => ({
      key: nextMatcherKey(),
      attributeId: matcher.attributeId,
      operator: matcher.operator,
      rawValue: matcher.displayValue ?? ""
    }))
  );
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const { data: dialogData } = useQuery<BomDialogData | null>({
    queryKey: ["bom-dialog-data", workspaceSlug],
    queryFn: async () => {
      const result = await getBomDialogDataAction({ workspaceSlug });
      return result.ok ? result.data : null;
    }
  });

  const categories = useMemo(() => dialogData?.categories ?? [], [dialogData]);
  const categoryTree = useMemo(() => buildCategoryTree(categories), [categories]);

  // Effective attributes for the selected category drive the matcher attribute picker.
  const { data: categoryAttributes } = useQuery<AttributeListItem[]>({
    queryKey: ["bom-category-attributes", workspaceSlug, categoryId],
    queryFn: async () => {
      const result = await getBomCategoryAttributesAction({ workspaceSlug, categoryId });
      return result.ok ? result.data : [];
    },
    enabled: Boolean(categoryId)
  });

  const attributesById = useMemo(() => {
    const map = new Map<string, AttributeListItem>();
    for (const attribute of categoryAttributes ?? []) {
      map.set(attribute.id, attribute);
    }
    return map;
  }, [categoryAttributes]);

  const designatorResult = useMemo(() => {
    if (!designators.trim()) return { quantity: 0, error: null as string | null };
    try {
      return { quantity: parseDesignatorRange(designators).quantity, error: null };
    } catch (error) {
      return { quantity: 0, error: error instanceof Error ? error.message : "invalid-designators" };
    }
  }, [designators]);

  function handleCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    // Matchers are scoped to a category's attributes; reset them when the scope changes.
    setMatchers([]);
  }

  function updateMatcher(key: string, patch: Partial<MatcherRow>) {
    setMatchers((prev) =>
      prev.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        if (patch.attributeId !== undefined && patch.attributeId !== row.attributeId) {
          const attribute = attributesById.get(patch.attributeId);
          const allowed = attribute ? MATCHER_OPERATORS_BY_TYPE[attribute.type] : ["EQ"];
          if (!allowed.includes(next.operator)) next.operator = allowed[0] as MatcherOperator;
          // The value control depends on the attribute type, so a prior value no longer applies.
          next.rawValue = "";
        }
        return next;
      })
    );
  }

  const readyMatchers = matchers.filter(
    (row) => row.attributeId && row.rawValue.trim().length > 0
  );

  const previewSpec = useMemo(
    () => ({
      categoryId: categoryId || null,
      pinnedPartId,
      matchers: readyMatchers.map((row) => ({
        attributeId: row.attributeId,
        operator: row.operator,
        rawValue: row.rawValue.trim()
      }))
    }),
    [categoryId, pinnedPartId, readyMatchers]
  );
  const debouncedSpec = useDebouncedValue(JSON.stringify(previewSpec), 400);

  const { data: preview } = useQuery({
    queryKey: ["bom-preview", workspaceSlug, debouncedSpec],
    queryFn: async () => {
      const spec = JSON.parse(debouncedSpec) as typeof previewSpec;
      const result = await previewLineItemMatchesAction({ workspaceSlug, ...spec });
      return result.ok ? result.data : { count: 0, parts: [] };
    },
    enabled:
      Boolean(previewSpec.pinnedPartId) ||
      previewSpec.matchers.length > 0 ||
      Boolean(previewSpec.categoryId)
  });

  function handleSubmit() {
    onSubmit({
      designators,
      categoryId: categoryId || null,
      pinnedPartId,
      notes: notes || null,
      matchers: readyMatchers.map((row) => ({
        attributeId: row.attributeId,
        operator: row.operator,
        rawValue: row.rawValue.trim()
      }))
    });
  }

  const canSave = designatorResult.quantity > 0 && !designatorResult.error && !isSaving;
  const matchersDisabled = Boolean(pinnedPartId);

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) handleSubmit();
      }}
    >
      <DialogBody>
        <div className="grid gap-4">
          {/* Designators */}
          <div>
            <LabelWithError htmlFor="bom-designators" error={designatorResult.error ?? undefined}>
              {labels.designators}
            </LabelWithError>
            <input
              id="bom-designators"
              className={`mt-1 font-mono ${inputClassName}`}
              placeholder={labels.designatorsPlaceholder}
              type="text"
              value={designators}
              onChange={(event) => setDesignators(event.target.value)}
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {labels.quantity}: {designatorResult.quantity}
            </p>
          </div>

          {/* Category */}
          <div>
            <CategoryTreeSelect
              allowOrganizationalCategories
              categories={categories}
              categoryTree={categoryTree}
              copy={{
                searchCategories: labels.searchCategories,
                noMatchingCategories: labels.noMatchingCategories,
                expandCategory: labels.expandCategory,
                collapseCategory: labels.collapseCategory
              }}
              disabled={false}
              label={labels.category}
              name="bom-category"
              noSelectionLabel={labels.noCategory}
              selectedId={categoryId}
              onSelectedIdChange={handleCategoryChange}
            />
          </div>

          {/* Pinned part */}
          <div>
            <label className="text-sm font-medium text-[var(--color-text-secondary)]">
              {labels.pinnedPart}
            </label>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex-1">
                <PartPickerCombobox
                  workspaceSlug={workspaceSlug}
                  inputValue={pinnedPartInput}
                  selectedPartId={pinnedPartId}
                  placeholder={labels.pinnedPartPlaceholder}
                  loadingLabel={labels.partLoading}
                  noMatchesLabel={labels.partNoMatches}
                  onInputChange={(value) => {
                    setPinnedPartInput(value);
                    if (pinnedPartId) setPinnedPartId(null);
                  }}
                  onSelect={(part) => {
                    setPinnedPartId(part.id);
                    setPinnedPartInput(part.catalogNumber);
                  }}
                />
              </div>
              {pinnedPartId ? (
                <button
                  className="rounded-md border border-[var(--color-border-strong)] px-2.5 py-2 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
                  type="button"
                  onClick={() => {
                    setPinnedPartId(null);
                    setPinnedPartInput("");
                  }}
                >
                  {labels.clearPinnedPart}
                </button>
              ) : null}
            </div>
            {pinnedPartId ? (
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">{labels.pinnedPartHint}</p>
            ) : null}
          </div>

          {/* Attribute matchers — only available once a category scopes the attributes */}
          {!matchersDisabled && categoryId ? (
            <div>
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                {labels.matchers}
              </span>
              <div className="mt-1 rounded-md border border-[var(--color-border)]">
                <div className="grid grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)_1.5rem] items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  <span>{labels.attributeColumn}</span>
                  <span className="text-center">{labels.operatorColumn}</span>
                  <span>{labels.valueColumn}</span>
                  <span />
                </div>
                {/* Fixed-height list with its own scroller; the add button sits at the end. */}
                <div className="h-44 overflow-y-auto px-3 py-2">
                  <div className="grid gap-2">
                  {matchers.map((row) => {
                    const attribute = attributesById.get(row.attributeId);
                    const allowedOperators = attribute
                      ? MATCHER_OPERATORS_BY_TYPE[attribute.type]
                      : (["EQ", "NEQ"] as MatcherOperator[]);
                    return (
                      <div
                        key={row.key}
                        className="grid grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)_1.5rem] items-center gap-2"
                      >
                        <select
                          className={`${inputClassName} min-w-0`}
                          value={row.attributeId}
                          onChange={(event) =>
                            updateMatcher(row.key, { attributeId: event.target.value })
                          }
                        >
                          <option value="">{labels.selectAttribute}</option>
                          {(categoryAttributes ?? []).map((attr) => (
                            <option key={attr.id} value={attr.id}>
                              {attr.name}
                            </option>
                          ))}
                        </select>
                        <select
                          className={`${inputClassName} min-w-0 px-1 text-center`}
                          value={row.operator}
                          onChange={(event) =>
                            updateMatcher(row.key, {
                              operator: event.target.value as MatcherOperator
                            })
                          }
                        >
                          {allowedOperators.map((operator) => (
                            <option key={operator} value={operator}>
                              {OPERATOR_LABELS[operator]}
                            </option>
                          ))}
                        </select>
                        {attribute?.type === "CHOICE" ? (
                          <select
                            className={`${inputClassName} min-w-0`}
                            value={row.rawValue}
                            onChange={(event) =>
                              updateMatcher(row.key, { rawValue: event.target.value })
                            }
                          >
                            <option value="">{labels.valuePlaceholder}</option>
                            {attribute.choiceOptions.map((choice) => (
                              <option key={choice.id} value={choice.label}>
                                {choice.label}
                              </option>
                            ))}
                          </select>
                        ) : attribute?.type === "BOOLEAN" ? (
                          <select
                            className={`${inputClassName} min-w-0`}
                            value={row.rawValue}
                            onChange={(event) =>
                              updateMatcher(row.key, { rawValue: event.target.value })
                            }
                          >
                            <option value="">{labels.valuePlaceholder}</option>
                            <option value="Yes">{labels.booleanYes}</option>
                            <option value="No">{labels.booleanNo}</option>
                          </select>
                        ) : (
                          <input
                            className={`${inputClassName} min-w-0`}
                            disabled={!attribute}
                            inputMode={
                              attribute?.type === "NUMBER" || attribute?.type === "QUANTITY"
                                ? "decimal"
                                : undefined
                            }
                            placeholder={
                              attribute?.baseUnitSymbol
                                ? `${labels.valuePlaceholder} (${attribute.baseUnitSymbol})`
                                : labels.valuePlaceholder
                            }
                            type="text"
                            value={row.rawValue}
                            onChange={(event) =>
                              updateMatcher(row.key, { rawValue: event.target.value })
                            }
                          />
                        )}
                        <button
                          aria-label={labels.removeMatcher}
                          title={labels.removeMatcher}
                          className="grid h-7 w-6 place-items-center rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg-subtle)] hover:text-[var(--color-text-secondary)]"
                          type="button"
                          onClick={() =>
                            setMatchers((prev) => prev.filter((item) => item.key !== row.key))
                          }
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                    <button
                      className="flex w-full items-center justify-center gap-1 rounded-md border border-dashed border-[var(--color-border-strong)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-subtle)]"
                      type="button"
                      onClick={() =>
                        setMatchers((prev) => [
                          ...prev,
                          { key: nextMatcherKey(), attributeId: "", operator: "EQ", rawValue: "" }
                        ])
                      }
                    >
                      + {labels.addMatcher}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : !matchersDisabled ? (
            <p className="text-sm text-[var(--color-text-muted)]">{labels.matchersNeedCategory}</p>
          ) : null}

          {/* Notes */}
          <div>
            <label
              className="text-sm font-medium text-[var(--color-text-secondary)]"
              htmlFor="bom-notes"
            >
              {labels.notes}
            </label>
            <input
              id="bom-notes"
              className={`mt-1 ${inputClassName}`}
              type="text"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          {/* Live match preview */}
          <div className="rounded-md border border-[var(--color-border)]">
            <p className="border-b border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {labels.preview} · {preview?.count ?? 0}
            </p>
            {/* Fixed-height area so the preview never grows or shrinks the dialog. */}
            <div className="h-48 overflow-auto">
              {preview && preview.parts.length > 0 ? (
                <>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        <th className="px-3 py-1.5 text-left">{labels.partCatalogColumn}</th>
                        <th className="px-3 py-1.5 text-left">{labels.partManufacturerColumn}</th>
                        <th className="px-3 py-1.5 text-left">{labels.partDescriptionColumn}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.parts.map((part) => (
                        <tr key={part.id} className="border-t border-[var(--color-border)]">
                          <td className="px-3 py-1.5 font-mono text-[var(--color-text-primary)]">
                            {part.catalogNumber}
                          </td>
                          <td className="px-3 py-1.5 text-[var(--color-text-secondary)]">
                            {part.manufacturerName}
                          </td>
                          <td className="px-3 py-1.5 text-[var(--color-text-secondary)]">
                            {part.description ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {preview.count > preview.parts.length ? (
                    <p className="px-3 py-1.5 text-xs text-[var(--color-text-muted)]">
                      {labels.previewMore(preview.count - preview.parts.length)}
                    </p>
                  ) : null}
                </>
              ) : (
                <p className="px-3 py-2 text-xs text-[var(--color-text-muted)]">{labels.previewEmpty}</p>
              )}
            </div>
          </div>
        </div>
      </DialogBody>
      <DialogActions
        actionLabel={editing ? labels.save : labels.create}
        disabled={!canSave}
        error={saveError ?? undefined}
        onCancel={onClose}
      />
    </form>
  );
}
