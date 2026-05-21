"use client";

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { createPart, updatePart } from "@/server/parts/createPart";
import type { PartCategoryListItem } from "@/server/parts/categories";
import type { PartsListItem } from "@/server/parts/getParts";

type Copy = {
  title: string;
  catalogNumber: string;
  categories: string;
  primaryCategory: string;
  secondaryCategory: string;
  noCategory: string;
  noSecondaryCategory: string;
  manufacturer: string;
  actions: string;
  newPartTitle: string;
  newPartBody: string;
  editPartTitle: string;
  editPartBody: string;
  catalogNumberPlaceholder: string;
  manufacturerPlaceholder: string;
  categoryPlaceholder: string;
  searchCategories: string;
  noMatchingCategories: string;
  expandCategory: string;
  collapseCategory: string;
  createPart: string;
  editPart: string;
  saveChanges: string;
  close: string;
  addPart: string;
  created: string;
  updated: string;
  missingRequiredFields: string;
  invalidCategory: string;
  secondaryWithoutPrimary: string;
  duplicateCategories: string;
  emptyTitle: string;
  emptyBody: string;
  databaseUnavailable: string;
};

type CategoryTreeItem = PartCategoryListItem & {
  children: CategoryTreeItem[];
};

type PartsListClientProps = {
  copy: Copy;
  isDatabaseAvailable: boolean;
  partCreated: boolean;
  partDialogOpen: boolean;
  partEditDialog?: string;
  partFormError?: string;
  partUpdated: boolean;
  partUpdateError?: string;
  partCategories: PartCategoryListItem[];
  parts: PartsListItem[];
  workspaceSlug: string;
};

export function PartsListClient({
  copy,
  isDatabaseAvailable,
  partCreated,
  partDialogOpen,
  partEditDialog,
  partFormError,
  partUpdated,
  partUpdateError,
  partCategories,
  parts,
  workspaceSlug
}: PartsListClientProps) {
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const categoryTree = buildCategoryTree(partCategories);
  const [createPrimaryCategoryId, setCreatePrimaryCategoryId] = useState("");
  const [createSecondaryCategoryId, setCreateSecondaryCategoryId] =
    useState("");
  const [editPrimaryCategoryId, setEditPrimaryCategoryId] = useState("");
  const [editSecondaryCategoryId, setEditSecondaryCategoryId] = useState("");
  const [editingPart, setEditingPart] = useState<PartsListItem | null>(() =>
    parts.find((part) => part.id === partEditDialog) ?? null
  );
  const hasFeedback = partCreated || partUpdated || partUpdateError;

  useEffect(() => {
    if (partDialogOpen) {
      openDialog(createDialogRef.current);
    }
  }, [partDialogOpen]);

  useEffect(() => {
    if (!partEditDialog) {
      return;
    }

    const part = parts.find((currentPart) => currentPart.id === partEditDialog);

    if (!part) {
      return;
    }

    window.requestAnimationFrame(() => {
      setEditingPart(part);
      setEditPrimaryCategoryId(part.primaryCategoryId ?? "");
      setEditSecondaryCategoryId(part.secondaryCategoryId ?? "");
      openDialog(editDialogRef.current);
    });
  }, [partEditDialog, parts]);

  function openEditDialog(part: PartsListItem) {
    setEditingPart(part);
    setEditPrimaryCategoryId(part.primaryCategoryId ?? "");
    setEditSecondaryCategoryId(part.secondaryCategoryId ?? "");
    window.requestAnimationFrame(() => openDialog(editDialogRef.current));
  }

  return (
    <>
      <section
        aria-labelledby="parts-heading"
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      >
        <h2 id="parts-heading" className="sr-only">
          {copy.title}
        </h2>
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-10">
            {hasFeedback ? (
              <>
                {partCreated ? (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                    {copy.created}
                  </p>
                ) : null}
                {partUpdated ? (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                    {copy.updated}
                  </p>
                ) : null}
                {partUpdateError ? (
                  <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
                    {getUpdateErrorMessage(copy, partUpdateError)}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
          <button
            className="min-h-10 rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            disabled={!isDatabaseAvailable}
            type="button"
            onClick={() => openDialog(createDialogRef.current)}
          >
            {copy.addPart}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-600"
                >
                  {copy.categories}
                </th>
                <th
                  scope="col"
                  className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-600"
                >
                  {copy.catalogNumber}
                </th>
                <th
                  scope="col"
                  className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-600"
                >
                  {copy.manufacturer}
                </th>
                <th
                  scope="col"
                  className="w-28 border-b border-slate-200 px-4 py-3 text-right font-semibold text-slate-600"
                >
                  {copy.actions}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {parts.length > 0 ? (
                parts.map((part) => (
                  <tr
                    key={part.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50"
                  >
                    <td className="border-b border-slate-100 px-4 py-3 text-slate-700">
                      <PartCategoriesSummary copy={copy} part={part} />
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 font-mono text-slate-950">
                      {part.catalogNumber}
                    </td>
                    <td className="border-b border-slate-100 px-4 py-3 text-slate-950">
                      {part.manufacturerName}
                    </td>
                    <td className="border-b border-slate-100 px-4 py-2 text-right">
                      <button
                        className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                        disabled={!isDatabaseAvailable}
                        type="button"
                        onClick={() => openEditDialog(part)}
                      >
                        {copy.editPart}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-10" colSpan={4}>
                    <p className="text-base font-medium text-slate-950">
                      {copy.emptyTitle}
                    </p>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                      {copy.emptyBody}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <dialog
        ref={createDialogRef}
        aria-labelledby="add-part-dialog-title"
        className="fixed inset-0 m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-2xl rounded-lg border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/40"
      >
        <div className="p-4 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h2
                id="add-part-dialog-title"
                className="text-lg font-semibold text-slate-950"
              >
                {copy.newPartTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {copy.newPartBody}
              </p>
            </div>
            <form method="dialog">
              <button
                className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                type="submit"
              >
                {copy.close}
              </button>
            </form>
          </div>

          {partFormError ? (
            <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {partFormError === "missing-required-fields"
                ? copy.missingRequiredFields
                : getCategoryErrorMessage(copy, partFormError)}
            </p>
          ) : null}

          <form action={createPart} className="grid gap-4">
            <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              {copy.catalogNumber}
              <input
                className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                name="catalogNumber"
                placeholder={copy.catalogNumberPlaceholder}
                required
                type="text"
                disabled={!isDatabaseAvailable}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              {copy.manufacturer}
              <input
                className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                name="manufacturerName"
                placeholder={copy.manufacturerPlaceholder}
                required
                type="text"
                disabled={!isDatabaseAvailable}
              />
            </label>
            <CategoryTreeSelect
              categories={partCategories}
              categoryTree={categoryTree}
              copy={copy}
              disabled={!isDatabaseAvailable}
              label={copy.primaryCategory}
              name="primaryCategoryId"
              noSelectionLabel={copy.noCategory}
              selectedId={createPrimaryCategoryId}
              onSelectedIdChange={(categoryId) => {
                setCreatePrimaryCategoryId(categoryId);
                setCreateSecondaryCategoryId("");
              }}
            />
            <CategoryTreeSelect
              categories={partCategories}
              categoryTree={categoryTree}
              copy={copy}
              disabled={!isDatabaseAvailable || !createPrimaryCategoryId}
              excludedCategoryId={createPrimaryCategoryId}
              label={copy.secondaryCategory}
              name="secondaryCategoryId"
              noSelectionLabel={copy.noSecondaryCategory}
              selectedId={createSecondaryCategoryId}
              onSelectedIdChange={setCreateSecondaryCategoryId}
            />
            <div className="flex justify-end">
              <button
                className="min-h-11 rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                type="submit"
                disabled={!isDatabaseAvailable}
              >
                {copy.createPart}
              </button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog
        ref={editDialogRef}
        aria-labelledby="edit-part-dialog-title"
        className="fixed inset-0 m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-2xl rounded-lg border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/40"
      >
        <div className="p-4 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h2
                id="edit-part-dialog-title"
                className="text-lg font-semibold text-slate-950"
              >
                {copy.editPartTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {copy.editPartBody}
              </p>
            </div>
            <form method="dialog">
              <button
                className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                type="submit"
              >
                {copy.close}
              </button>
            </form>
          </div>

          {partUpdateError ? (
            <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {partUpdateError === "missing-required-fields"
                ? copy.missingRequiredFields
                : getCategoryErrorMessage(copy, partUpdateError)}
            </p>
          ) : null}

          {editingPart ? (
            <form action={updatePart} className="grid gap-4">
              <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
              <input name="id" type="hidden" value={editingPart.id} />
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                {copy.catalogNumber}
                <input
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                  defaultValue={editingPart.catalogNumber}
                  name="catalogNumber"
                  placeholder={copy.catalogNumberPlaceholder}
                  required
                  type="text"
                  disabled={!isDatabaseAvailable}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                {copy.manufacturer}
                <input
                  className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                  defaultValue={editingPart.manufacturerName}
                  name="manufacturerName"
                  placeholder={copy.manufacturerPlaceholder}
                  required
                  type="text"
                  disabled={!isDatabaseAvailable}
                />
              </label>
              <CategoryTreeSelect
                categories={partCategories}
                categoryTree={categoryTree}
                copy={copy}
                disabled={!isDatabaseAvailable}
                label={copy.primaryCategory}
                name="primaryCategoryId"
                noSelectionLabel={copy.noCategory}
                selectedId={editPrimaryCategoryId}
                onSelectedIdChange={(categoryId) => {
                  setEditPrimaryCategoryId(categoryId);

                  if (!categoryId || editSecondaryCategoryId === categoryId) {
                    setEditSecondaryCategoryId("");
                  }
                }}
              />
              <CategoryTreeSelect
                key={`${editingPart.id}-${editPrimaryCategoryId}`}
                categories={partCategories}
                categoryTree={categoryTree}
                copy={copy}
                disabled={!isDatabaseAvailable || !editPrimaryCategoryId}
                excludedCategoryId={editPrimaryCategoryId}
                label={copy.secondaryCategory}
                name="secondaryCategoryId"
                noSelectionLabel={copy.noSecondaryCategory}
                selectedId={editSecondaryCategoryId}
                onSelectedIdChange={setEditSecondaryCategoryId}
              />
              <div className="flex justify-end">
                <button
                  className="min-h-11 rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  type="submit"
                  disabled={!isDatabaseAvailable}
                >
                  {copy.saveChanges}
                </button>
              </div>
            </form>
          ) : null}
        </div>
      </dialog>
    </>
  );
}

function openDialog(dialog: HTMLDialogElement | null) {
  if (!dialog || dialog.open) {
    return;
  }

  try {
    dialog.showModal();
  } catch {
    dialog.setAttribute("open", "");
  }
}

function getUpdateErrorMessage(copy: Copy, error: string) {
  if (error === "missing-required-fields") {
    return copy.missingRequiredFields;
  }

  return getCategoryErrorMessage(copy, error);
}

function getCategoryErrorMessage(copy: Copy, error: string) {
  if (error === "invalid-category") {
    return copy.invalidCategory;
  }

  if (error === "secondary-without-primary") {
    return copy.secondaryWithoutPrimary;
  }

  if (error === "duplicate-categories") {
    return copy.duplicateCategories;
  }

  return copy.databaseUnavailable;
}

function CategoryTreeSelect({
  categories,
  categoryTree,
  copy,
  disabled,
  excludedCategoryId,
  label,
  name,
  noSelectionLabel,
  selectedId,
  onSelectedIdChange
}: {
  categories: PartCategoryListItem[];
  categoryTree: CategoryTreeItem[];
  copy: Copy;
  disabled: boolean;
  excludedCategoryId?: string;
  label: string;
  name: string;
  noSelectionLabel: string;
  selectedId: string;
  onSelectedIdChange: (categoryId: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const labelId = `${name}-label`;
  const buttonId = `${name}-button`;
  const searchId = `${name}-search`;
  const currentSelectedId = selectedId;
  const currentSelectedCategory = categories.find(
    (category) => category.id === currentSelectedId
  );
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState(currentSelectedId);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(
    () => getAncestorIds(categories, selectedId)
  );
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase("en");
  const visibleTree = normalizedSearchQuery
    ? filterCategoryTree(categoryTree, normalizedSearchQuery)
    : categoryTree;
  const searchExpandedCategoryIds = normalizedSearchQuery
    ? getExpandableCategoryIds(visibleTree)
    : expandedCategoryIds;
  const effectiveExpandedCategoryIds = normalizedSearchQuery
    ? searchExpandedCategoryIds
    : expandedCategoryIds;
  const visibleCategoryOptions = getVisibleCategoryOptions(
    visibleTree,
    effectiveExpandedCategoryIds
  );
  const activeCategory = visibleCategoryOptions.find(
    (category) => category.id === activeCategoryId
  );
  const keyboardOptionIds = [
    "",
    ...visibleCategoryOptions.map((category) => category.id)
  ];

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (
        event.target instanceof Node &&
        !containerRef.current?.contains(event.target) &&
        !panelRef.current?.contains(event.target)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
      }
    }

    function onReposition() {
      const nextStyle = getFloatingPanelStyle(containerRef.current);

      if (nextStyle) {
        setPanelStyle(nextStyle);
      }
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [isOpen]);

  function openSelect() {
    if (disabled) {
      return;
    }

    setExpandedCategoryIds(getAncestorIds(categories, currentSelectedId));
    setActiveCategoryId(currentSelectedId);
    setPanelStyle(getFloatingPanelStyle(containerRef.current) ?? {});
    setPortalTarget(containerRef.current?.closest("dialog") ?? document.body);
    setIsOpen(true);
  }

  function setSelectedCategory(categoryId: string) {
    onSelectedIdChange(categoryId);
    setIsOpen(false);
    setSearchQuery("");
    setActiveCategoryId(categoryId);
    setExpandedCategoryIds(getAncestorIds(categories, categoryId));
  }

  function updateSearchQuery(query: string) {
    const normalizedQuery = query.trim().toLocaleLowerCase("en");

    setSearchQuery(query);

    if (!normalizedQuery) {
      return;
    }

    const firstMatchingCategory = findFirstAssignableCategory(
      filterCategoryTree(categoryTree, normalizedQuery),
      excludedCategoryId
    );

    if (!firstMatchingCategory) {
      return;
    }

    setActiveCategoryId(firstMatchingCategory.id);
    if (firstMatchingCategory.id === currentSelectedId) {
      return;
    }

    onSelectedIdChange(firstMatchingCategory.id);
    setExpandedCategoryIds(getAncestorIds(categories, firstMatchingCategory.id));
  }

  function moveActiveCategory(direction: 1 | -1) {
    if (keyboardOptionIds.length === 0) {
      return;
    }

    const currentIndex = keyboardOptionIds.indexOf(activeCategoryId);
    const nextIndex =
      currentIndex === -1
        ? direction === 1
          ? 0
          : keyboardOptionIds.length - 1
        : (currentIndex + direction + keyboardOptionIds.length) %
          keyboardOptionIds.length;

    setActiveCategoryId(keyboardOptionIds[nextIndex]);
  }

  function commitActiveCategory() {
    if (!keyboardOptionIds.includes(activeCategoryId)) {
      return;
    }

    if (activeCategoryId === "") {
      setSelectedCategory("");
      return;
    }

    if (!activeCategory) {
      return;
    }

    if (activeCategory.isAssignable && activeCategory.id !== excludedCategoryId) {
      setSelectedCategory(activeCategory.id);
      return;
    }

    if (activeCategory.children.length > 0) {
      toggleExpanded(activeCategory.id);
    }
  }

  function handleComboboxKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!isOpen) {
        openSelect();
      } else {
        moveActiveCategory(1);
      }
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (!isOpen) {
        openSelect();
      } else {
        moveActiveCategory(-1);
      }
    }

    if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      commitActiveCategory();
    }

    if (event.key === "ArrowRight" && isOpen) {
      if (!activeCategory || activeCategory.children.length === 0) {
        return;
      }

      event.preventDefault();
      setExpandedCategoryIds(
        new Set(expandedCategoryIds).add(activeCategory.id)
      );
    }

    if (event.key === "ArrowLeft" && isOpen) {
      if (!activeCategory || activeCategory.children.length === 0) {
        return;
      }

      event.preventDefault();
      const nextIds = new Set(expandedCategoryIds);
      nextIds.delete(activeCategory.id);
      setExpandedCategoryIds(nextIds);
    }
  }

  function toggleExpanded(categoryId: string) {
    const nextIds = new Set(expandedCategoryIds);

    if (nextIds.has(categoryId)) {
      nextIds.delete(categoryId);
    } else {
      nextIds.add(categoryId);
    }

    setExpandedCategoryIds(nextIds);
  }

  return (
    <div ref={containerRef} className="relative grid gap-2">
      <span id={labelId} className="text-sm font-medium text-slate-700">
        {label}
      </span>
      <input name={name} type="hidden" value={currentSelectedId} />
      <button
        id={buttonId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`${label} ${
          currentSelectedCategory?.path ?? noSelectionLabel
        }`}
        className="grid min-h-11 grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-base text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        disabled={disabled}
        type="button"
        onClick={() => (isOpen ? setIsOpen(false) : openSelect())}
        onKeyDown={handleComboboxKeyDown}
      >
        <span className={currentSelectedCategory ? "truncate" : "text-slate-400"}>
          {currentSelectedCategory?.path ?? noSelectionLabel}
        </span>
        <span aria-hidden="true" className="text-sm text-slate-500">
          ▾
        </span>
      </button>

      {isOpen
        ? createPortal(
            <div
              ref={panelRef}
              className="fixed z-50 flex overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
              style={panelStyle}
              onKeyDown={handleComboboxKeyDown}
            >
              <div className="flex min-h-0 w-full flex-col">
                <div className="border-b border-slate-200 p-2">
                  <label className="sr-only" htmlFor={searchId}>
                    {copy.searchCategories}
                  </label>
                  <input
                    id={searchId}
                    autoFocus
                    className="min-h-10 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                    placeholder={copy.searchCategories}
                    type="search"
                    value={searchQuery}
                    onChange={(event) =>
                      updateSearchQuery(event.currentTarget.value)
                    }
                    onKeyDown={handleComboboxKeyDown}
                  />
                </div>
                <div
                  aria-labelledby={labelId}
                  className="min-h-0 overflow-auto p-2"
                  role="listbox"
                >
                  <button
                    aria-selected={currentSelectedId === ""}
                    className={`mb-1 grid min-h-9 w-full grid-cols-[1.75rem_1fr] items-center rounded-md px-2 py-1.5 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-slate-300 ${
                      activeCategoryId === ""
                        ? "bg-cyan-100 font-semibold text-slate-950 hover:bg-cyan-100"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                    role="option"
                    type="button"
                    onClick={() => setSelectedCategory("")}
                  >
                    <span />
                    <span>{noSelectionLabel}</span>
                  </button>
                  {visibleTree.length > 0 ? (
                    <ol className="grid gap-1">
                      {visibleTree.map((category) => (
                        <CategoryTreeSelectNode
                          key={category.id}
                          category={category}
                          copy={copy}
                          excludedCategoryId={excludedCategoryId}
                          expandedCategoryIds={effectiveExpandedCategoryIds}
                          activeCategoryId={activeCategoryId}
                          level={0}
                          selectedId={currentSelectedId}
                          onSelect={setSelectedCategory}
                          onToggleExpanded={toggleExpanded}
                        />
                      ))}
                    </ol>
                  ) : (
                    <p className="px-2 py-6 text-center text-sm text-slate-500">
                      {copy.noMatchingCategories}
                    </p>
                  )}
                </div>
              </div>
            </div>,
            portalTarget ?? document.body
          )
        : null}
    </div>
  );
}

function CategoryTreeSelectNode({
  category,
  copy,
  excludedCategoryId,
  expandedCategoryIds,
  activeCategoryId,
  level,
  selectedId,
  onSelect,
  onToggleExpanded
}: {
  category: CategoryTreeItem;
  copy: Copy;
  excludedCategoryId?: string;
  expandedCategoryIds: Set<string>;
  activeCategoryId: string;
  level: number;
  selectedId: string;
  onSelect: (categoryId: string) => void;
  onToggleExpanded: (categoryId: string) => void;
}) {
  const hasChildren = category.children.length > 0;
  const isExpanded = expandedCategoryIds.has(category.id);
  const isSelectable =
    category.isAssignable && category.id !== excludedCategoryId;
  const isSelected = selectedId === category.id;
  const isActive = activeCategoryId === category.id;
  const activeClassName = isSelectable
    ? "bg-cyan-100 font-semibold text-slate-950 hover:bg-cyan-100"
    : "bg-white font-medium text-slate-800 ring-2 ring-inset ring-slate-400";
  const toggleLabel = isExpanded
    ? `${copy.collapseCategory} ${category.name}`
    : `${copy.expandCategory} ${category.name}`;

  return (
    <li>
      <div
        className="grid min-h-9 grid-cols-[1.75rem_1fr] items-center rounded-md"
        style={{ paddingLeft: `${level}rem` }}
      >
        {hasChildren ? (
          <button
            aria-expanded={isExpanded}
            aria-label={toggleLabel}
            className="grid h-7 w-7 place-items-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-300"
            type="button"
            onClick={() => onToggleExpanded(category.id)}
          >
            <span
              aria-hidden="true"
              className={`text-xs leading-none transition-transform ${
                isExpanded ? "rotate-90" : ""
              }`}
            >
              ▶
            </span>
          </button>
        ) : (
          <span />
        )}
        <button
          aria-disabled={!isSelectable}
          aria-selected={isSelected}
          className={`min-h-9 rounded-md px-2 py-1.5 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-slate-300 ${
            isActive ? activeClassName : "text-slate-700"
          } ${
            isSelectable && !isSelected ? "hover:bg-slate-50" : ""
          } ${
            !isSelectable && !isActive ? "text-slate-500" : ""
          }`}
          role="option"
          type="button"
          onClick={() =>
            isSelectable ? onSelect(category.id) : onToggleExpanded(category.id)
          }
        >
          <span className="block truncate">{category.name}</span>
        </button>
      </div>
      {hasChildren && isExpanded ? (
        <ol className="mt-1 grid gap-1">
          {category.children.map((child) => (
            <CategoryTreeSelectNode
              key={child.id}
              category={child}
              copy={copy}
              excludedCategoryId={excludedCategoryId}
              expandedCategoryIds={expandedCategoryIds}
              activeCategoryId={activeCategoryId}
              level={level + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function getFloatingPanelStyle(
  anchor: HTMLElement | null
): CSSProperties | null {
  if (!anchor) {
    return null;
  }

  const viewportPadding = 16;
  const gap = 4;
  const minimumHeight = 220;
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - viewportPadding - gap;
  const spaceAbove = rect.top - viewportPadding - gap;
  const opensDown = spaceBelow >= minimumHeight || spaceBelow >= spaceAbove;
  const maxHeight = Math.max(160, Math.floor(opensDown ? spaceBelow : spaceAbove));

  return {
    left: rect.left,
    width: rect.width,
    maxHeight,
    ...(opensDown
      ? { top: rect.bottom + gap }
      : { bottom: window.innerHeight - rect.top + gap })
  };
}

function buildCategoryTree(categories: PartCategoryListItem[]) {
  const nodesById = new Map<string, CategoryTreeItem>();

  for (const category of categories) {
    nodesById.set(category.id, { ...category, children: [] });
  }

  const roots: CategoryTreeItem[] = [];

  for (const category of categories) {
    const node = nodesById.get(category.id);

    if (!node) {
      continue;
    }

    const parent = category.parentId
      ? nodesById.get(category.parentId)
      : undefined;

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  sortCategoryTree(roots);

  return roots;
}

function sortCategoryTree(categories: CategoryTreeItem[]) {
  categories.sort((left, right) =>
    left.name.localeCompare(right.name, "en", { sensitivity: "base" })
  );

  for (const category of categories) {
    sortCategoryTree(category.children);
  }
}

function getAncestorIds(categories: PartCategoryListItem[], categoryId: string) {
  const categoriesById = new Map(
    categories.map((category) => [category.id, category])
  );
  const ancestorIds = new Set<string>();
  let currentCategory = categoriesById.get(categoryId);

  while (currentCategory?.parentId) {
    ancestorIds.add(currentCategory.parentId);
    currentCategory = categoriesById.get(currentCategory.parentId);
  }

  return ancestorIds;
}

function getExpandableCategoryIds(categories: CategoryTreeItem[]) {
  const expandableIds = new Set<string>();

  for (const category of categories) {
    if (category.children.length > 0) {
      expandableIds.add(category.id);
    }

    for (const childId of getExpandableCategoryIds(category.children)) {
      expandableIds.add(childId);
    }
  }

  return expandableIds;
}

function filterCategoryTree(
  categories: CategoryTreeItem[],
  normalizedSearchQuery: string
) {
  const filteredCategories: CategoryTreeItem[] = [];

  for (const category of categories) {
    const children = filterCategoryTree(category.children, normalizedSearchQuery);
    const matches =
      category.name.toLocaleLowerCase("en").includes(normalizedSearchQuery) ||
      category.path.toLocaleLowerCase("en").includes(normalizedSearchQuery);

    if (matches || children.length > 0) {
      filteredCategories.push({ ...category, children });
    }
  }

  return filteredCategories;
}

function findFirstAssignableCategory(
  categories: CategoryTreeItem[],
  excludedCategoryId?: string
): CategoryTreeItem | null {
  for (const category of categories) {
    if (category.isAssignable && category.id !== excludedCategoryId) {
      return category;
    }

    const matchingChild = findFirstAssignableCategory(
      category.children,
      excludedCategoryId
    );

    if (matchingChild) {
      return matchingChild;
    }
  }

  return null;
}

function getVisibleCategoryOptions(
  categories: CategoryTreeItem[],
  expandedCategoryIds: Set<string>
) {
  const visibleCategories: CategoryTreeItem[] = [];

  for (const category of categories) {
    visibleCategories.push(category);

    if (expandedCategoryIds.has(category.id)) {
      visibleCategories.push(
        ...getVisibleCategoryOptions(category.children, expandedCategoryIds)
      );
    }
  }

  return visibleCategories;
}

function PartCategoriesSummary({
  copy,
  part
}: {
  copy: Copy;
  part: PartsListItem;
}) {
  if (!part.primaryCategoryPath && !part.secondaryCategoryPath) {
    return <span className="text-slate-400">{copy.noCategory}</span>;
  }

  return (
    <div className="grid gap-1">
      {part.primaryCategoryPath ? (
        <span>
          <span className="font-medium text-slate-500">
            {copy.primaryCategory}:{" "}
          </span>
          {part.primaryCategoryPath}
        </span>
      ) : null}
      {part.secondaryCategoryPath ? (
        <span>
          <span className="font-medium text-slate-500">
            {copy.secondaryCategory}:{" "}
          </span>
          {part.secondaryCategoryPath}
        </span>
      ) : null}
    </div>
  );
}
