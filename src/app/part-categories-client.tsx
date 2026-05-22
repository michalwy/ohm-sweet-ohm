"use client";

import { useMutation } from "@tanstack/react-query";
import {
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from "react";

import {
  createPartCategoryFromForm,
  updatePartCategoryFromForm
} from "@/server/parts/categoryActions";
import type { PartCategoryListItem } from "@/server/parts/categories";
import { ToastNotice } from "@/app/toast-notice";

type Copy = {
  title: string;
  addRootCategory: string;
  addChild: string;
  edit: string;
  expandCategory: string;
  collapseCategory: string;
  actions: string;
  newCategoryTitle: string;
  newCategoryBody: string;
  editCategoryTitle: string;
  editCategoryBody: string;
  name: string;
  namePlaceholder: string;
  parentCategory: string;
  rootCategory: string;
  type: string;
  organizational: string;
  assignable: string;
  createCategory: string;
  saveChanges: string;
  close: string;
  createdToast: string;
  updatedToast: string;
  missingRequiredFields: string;
  invalidParentCategory: string;
  categoryNotFound: string;
  categoryTreeCycle: string;
  permissionDenied: string;
  emptyTitle: string;
  emptyBody: string;
  databaseUnavailable: string;
};

type CategoryTreeItem = PartCategoryListItem & {
  children: CategoryTreeItem[];
};

type PartCategoriesClientProps = {
  categories: PartCategoryListItem[];
  categoryDialogOpen: boolean;
  categoryEditDialog?: string;
  copy: Copy;
  isDatabaseAvailable: boolean;
  canWriteCategories: boolean;
  workspaceSlug: string;
};

export function PartCategoriesClient({
  categories,
  categoryDialogOpen,
  categoryEditDialog,
  copy,
  isDatabaseAvailable,
  canWriteCategories,
  workspaceSlug
}: PartCategoriesClientProps) {
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const [currentCategories, setCurrentCategories] = useState(categories);
  const [createParentId, setCreateParentId] = useState("");
  const [editingCategory, setEditingCategory] =
    useState<PartCategoryListItem | null>(() =>
      currentCategories.find((category) => category.id === categoryEditDialog) ??
      null
    );
  const [createFormResetKey, setCreateFormResetKey] = useState(0);
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [updateFormError, setUpdateFormError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{
    id: number;
    message: string;
  } | null>(null);
  const categoryTree = useMemo(
    () => buildCategoryTree(currentCategories),
    [currentCategories]
  );
  const categoryExpansionStorageKey = `oso:${workspaceSlug}:part-category-expansion`;
  const defaultExpandedCategoryIds = useMemo(
    () => getExpandableCategoryIds(categoryTree),
    [categoryTree]
  );
  const expandedCategoryIds = useStoredExpandedCategoryIds(
    categoryExpansionStorageKey,
    defaultExpandedCategoryIds
  );
  const createCategoryMutation = useMutation({
    mutationFn: createPartCategoryFromForm,
    onError: () => {
      setCreateFormError("database-unavailable");
    },
    onSuccess: (result) => {
      if (!result.ok) {
        setCreateFormError(result.error);
        return;
      }

      setCurrentCategories(result.categories);
      setCreateParentId("");
      setCreateFormResetKey((currentKey) => currentKey + 1);
      setCreateFormError(null);
      setToastMessage({
        id: result.submittedAt,
        message: getCategorySuccessMessage(copy.createdToast, result.category)
      });
      closeDialog(createDialogRef.current);
    }
  });
  const updateCategoryMutation = useMutation({
    mutationFn: updatePartCategoryFromForm,
    onError: () => {
      setUpdateFormError("database-unavailable");
    },
    onSuccess: (result) => {
      if (!result.ok) {
        setUpdateFormError(result.error);
        return;
      }

      setCurrentCategories(result.categories);
      setEditingCategory(result.category);
      setUpdateFormError(null);
      setToastMessage({
        id: result.submittedAt,
        message: getCategorySuccessMessage(copy.updatedToast, result.category)
      });
      closeDialog(editDialogRef.current);
    }
  });

  useEffect(() => {
    if (categoryDialogOpen) {
      openDialog(createDialogRef.current);
    }
  }, [categoryDialogOpen]);

  useEffect(() => {
    if (!categoryEditDialog) {
      return;
    }

    const category = currentCategories.find(
      (currentCategory) => currentCategory.id === categoryEditDialog
    );

    if (!category) {
      return;
    }

    window.requestAnimationFrame(() => {
      setEditingCategory(category);
      openDialog(editDialogRef.current);
    });
  }, [currentCategories, categoryEditDialog]);

  function openCreateDialog(parentId: string | null) {
    setCreateParentId(parentId ?? "");

    if (parentId) {
      const nextIds = new Set(expandedCategoryIds);
      nextIds.add(parentId);
      saveExpandedCategoryIds(categoryExpansionStorageKey, nextIds);
    }

    setCreateFormError(null);
    window.requestAnimationFrame(() => openDialog(createDialogRef.current));
  }

  function openEditDialog(category: PartCategoryListItem) {
    setEditingCategory(category);
    setUpdateFormError(null);
    window.requestAnimationFrame(() => openDialog(editDialogRef.current));
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateFormError(null);
    createCategoryMutation.mutate(new FormData(event.currentTarget));
  }

  function handleUpdateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUpdateFormError(null);
    updateCategoryMutation.mutate(new FormData(event.currentTarget));
  }

  return (
    <>
      <section
        aria-labelledby="part-categories-heading"
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      >
        <h2 id="part-categories-heading" className="sr-only">
          {copy.title}
        </h2>
        <div className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <button
            className="min-h-10 rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            disabled={!isDatabaseAvailable || !canWriteCategories}
            type="button"
            onClick={() => openCreateDialog(null)}
          >
            {copy.addRootCategory}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm border border-cyan-200 bg-cyan-50" />
              {copy.assignable}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-sm border border-slate-300 bg-slate-100" />
              {copy.organizational}
            </span>
          </div>

          {categoryTree.length > 0 ? (
            <ol className="grid gap-1">
              {categoryTree.map((category) => (
                <CategoryNode
                  key={category.id}
                  canWriteCategories={canWriteCategories}
                  category={category}
                  copy={copy}
                  isDatabaseAvailable={isDatabaseAvailable}
                  level={0}
                  onAddChild={openCreateDialog}
                  onEdit={openEditDialog}
                  expandedCategoryIds={expandedCategoryIds}
                  onToggleExpanded={(categoryId) => {
                    const nextIds = new Set(expandedCategoryIds);

                    if (nextIds.has(categoryId)) {
                      nextIds.delete(categoryId);
                    } else {
                      nextIds.add(categoryId);
                    }

                    saveExpandedCategoryIds(
                      categoryExpansionStorageKey,
                      nextIds
                    );
                  }}
                />
              ))}
            </ol>
          ) : (
            <div className="py-10">
              <p className="text-base font-medium text-slate-950">
                {copy.emptyTitle}
              </p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                {copy.emptyBody}
              </p>
            </div>
          )}
        </div>
      </section>

      <ToastNotice key={toastMessage?.id} message={toastMessage?.message} />

      <dialog
        ref={createDialogRef}
        aria-labelledby="add-category-dialog-title"
        className="fixed inset-0 m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-2xl rounded-lg border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/40"
      >
        <div className="p-6">
          <DialogHeader
            body={copy.newCategoryBody}
            closeLabel={copy.close}
            title={copy.newCategoryTitle}
            titleId="add-category-dialog-title"
          />

          {createFormError ? (
            <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {getCategoryErrorMessage(copy, createFormError)}
            </p>
          ) : null}

          <form
            key={createFormResetKey}
            className="grid gap-4"
            onSubmit={handleCreateSubmit}
          >
            <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
            <CategoryFormFields
              categories={currentCategories}
              copy={copy}
              defaultIsAssignable={true}
              isDatabaseAvailable={isDatabaseAvailable}
              nameDefaultValue=""
              parentId={createParentId}
              setParentId={setCreateParentId}
            />
            <div className="flex justify-end">
              <button
                className="min-h-11 rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                disabled={
                  !isDatabaseAvailable ||
                  !canWriteCategories ||
                  createCategoryMutation.isPending
                }
                type="submit"
              >
                {copy.createCategory}
              </button>
            </div>
          </form>
        </div>
      </dialog>

      <dialog
        ref={editDialogRef}
        aria-labelledby="edit-category-dialog-title"
        className="fixed inset-0 m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-2xl rounded-lg border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/40"
      >
        <div className="p-6">
          <DialogHeader
            body={copy.editCategoryBody}
            closeLabel={copy.close}
            title={copy.editCategoryTitle}
            titleId="edit-category-dialog-title"
          />

          {updateFormError ? (
            <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {getCategoryErrorMessage(copy, updateFormError)}
            </p>
          ) : null}

          {editingCategory ? (
            <form
              key={editingCategory.id}
              className="grid gap-4"
              onSubmit={handleUpdateSubmit}
            >
              <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
              <input name="id" type="hidden" value={editingCategory.id} />
              <CategoryFormFields
                categories={currentCategories}
                copy={copy}
                defaultIsAssignable={editingCategory.isAssignable}
                excludedCategoryId={editingCategory.id}
                isDatabaseAvailable={isDatabaseAvailable}
                nameDefaultValue={editingCategory.name}
                parentId={editingCategory.parentId ?? ""}
              />
              <div className="flex justify-end">
                <button
                  className="min-h-11 rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  disabled={
                    !isDatabaseAvailable ||
                    !canWriteCategories ||
                    updateCategoryMutation.isPending
                  }
                  type="submit"
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

function CategoryNode({
  canWriteCategories,
  category,
  copy,
  isDatabaseAvailable,
  level,
  onAddChild,
  onEdit,
  expandedCategoryIds,
  onToggleExpanded
}: {
  canWriteCategories: boolean;
  category: CategoryTreeItem;
  copy: Copy;
  isDatabaseAvailable: boolean;
  level: number;
  onAddChild: (parentId: string) => void;
  onEdit: (category: PartCategoryListItem) => void;
  expandedCategoryIds: Set<string>;
  onToggleExpanded: (categoryId: string) => void;
}) {
  const hasChildren = category.children.length > 0;
  const isExpanded = expandedCategoryIds.has(category.id);
  const toggleLabel = isExpanded
    ? `${copy.collapseCategory} ${category.name}`
    : `${copy.expandCategory} ${category.name}`;

  return (
    <li>
      <div
        data-testid="part-category-node"
        className={`grid min-h-12 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-md border-l-4 px-3 py-2 ${
          category.isAssignable
            ? "border-cyan-300 bg-cyan-50/60 text-slate-950"
            : "border-slate-300 bg-slate-50 text-slate-600"
        }`}
        style={{ marginLeft: `${level * 1.25}rem` }}
      >
        {hasChildren ? (
          <button
            aria-expanded={isExpanded}
            aria-label={toggleLabel}
            className="grid h-7 w-7 shrink-0 place-items-center rounded text-slate-500 transition hover:bg-white/70 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
            type="button"
            onClick={() => onToggleExpanded(category.id)}
          >
            <span
              aria-hidden="true"
              className={`text-sm leading-none transition-transform ${
                isExpanded ? "rotate-90" : ""
              }`}
            >
              ▶
            </span>
          </button>
        ) : (
          <span className="h-7 w-7" aria-hidden="true" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{category.name}</p>
          <p className="truncate text-xs text-slate-500">{category.path}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            disabled={!isDatabaseAvailable || !canWriteCategories}
            type="button"
            onClick={() => onAddChild(category.id)}
          >
            {copy.addChild}
          </button>
          <button
            className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            disabled={!isDatabaseAvailable || !canWriteCategories}
            type="button"
            onClick={() => onEdit(category)}
          >
            {copy.edit}
          </button>
        </div>
      </div>
      {hasChildren && isExpanded ? (
        <ol className="mt-1 grid gap-1">
          {category.children.map((child) => (
            <CategoryNode
              key={child.id}
              canWriteCategories={canWriteCategories}
              category={child}
              copy={copy}
              isDatabaseAvailable={isDatabaseAvailable}
              level={level + 1}
              onAddChild={onAddChild}
              onEdit={onEdit}
              expandedCategoryIds={expandedCategoryIds}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
        </ol>
      ) : null}
    </li>
  );
}

function CategoryFormFields({
  categories,
  copy,
  defaultIsAssignable,
  excludedCategoryId,
  isDatabaseAvailable,
  nameDefaultValue,
  parentId,
  setParentId
}: {
  categories: PartCategoryListItem[];
  copy: Copy;
  defaultIsAssignable: boolean;
  excludedCategoryId?: string;
  isDatabaseAvailable: boolean;
  nameDefaultValue: string;
  parentId: string;
  setParentId?: (parentId: string) => void;
}) {
  const excludedIds = excludedCategoryId
    ? getCategoryAndDescendantIds(categories, excludedCategoryId)
    : new Set<string>();
  const parentOptions = categories.filter(
    (category) => !excludedIds.has(category.id)
  );

  return (
    <>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        {copy.name}
        <input
          className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          defaultValue={nameDefaultValue}
          disabled={!isDatabaseAvailable}
          name="name"
          placeholder={copy.namePlaceholder}
          required
          type="text"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        {copy.parentCategory}
        <select
          className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          defaultValue={setParentId ? undefined : parentId}
          disabled={!isDatabaseAvailable}
          name="parentId"
          value={setParentId ? parentId : undefined}
          onChange={
            setParentId
              ? (event) => setParentId(event.currentTarget.value)
              : undefined
          }
        >
          <option value="">{copy.rootCategory}</option>
          {parentOptions.map((category) => (
            <option key={category.id} value={category.id}>
              {category.path}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium text-slate-700">
          {copy.type}
        </legend>
        <div className="grid grid-cols-2 gap-2">
          <label className="relative">
            <input
              className="peer sr-only"
              defaultChecked={!defaultIsAssignable}
              disabled={!isDatabaseAvailable}
              name="type"
              type="radio"
              value="organizational"
            />
            <span className="grid min-h-11 cursor-pointer place-items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition peer-checked:border-slate-500 peer-checked:bg-slate-100 peer-focus:ring-2 peer-focus:ring-slate-200 peer-disabled:cursor-not-allowed peer-disabled:bg-slate-50 peer-disabled:text-slate-400">
              {copy.organizational}
            </span>
          </label>
          <label className="relative">
            <input
              className="peer sr-only"
              defaultChecked={defaultIsAssignable}
              disabled={!isDatabaseAvailable}
              name="type"
              type="radio"
              value="assignable"
            />
            <span className="grid min-h-11 cursor-pointer place-items-center rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition peer-checked:border-cyan-400 peer-checked:bg-cyan-50 peer-focus:ring-2 peer-focus:ring-cyan-100 peer-disabled:cursor-not-allowed peer-disabled:bg-slate-50 peer-disabled:text-slate-400">
              {copy.assignable}
            </span>
          </label>
        </div>
      </fieldset>
    </>
  );
}

function DialogHeader({
  body,
  closeLabel,
  title,
  titleId
}: {
  body: string;
  closeLabel: string;
  title: string;
  titleId: string;
}) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
      <div>
        <h2 id={titleId} className="text-lg font-semibold text-slate-950">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{body}</p>
      </div>
      <form method="dialog">
        <button
          className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          type="submit"
        >
          {closeLabel}
        </button>
      </form>
    </div>
  );
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

function useStoredExpandedCategoryIds(
  storageKey: string,
  defaultExpandedCategoryIds: Set<string>
) {
  const storedValue = useSyncExternalStore(
    subscribeToCategoryExpansionStorage,
    () => readStoredExpandedCategoryIds(storageKey),
    () => null
  );

  return useMemo(() => {
    if (!storedValue) {
      return defaultExpandedCategoryIds;
    }

    try {
      const parsedValue: unknown = JSON.parse(storedValue);

      if (!Array.isArray(parsedValue)) {
        return defaultExpandedCategoryIds;
      }

      return new Set(
        parsedValue.filter(
          (categoryId): categoryId is string => typeof categoryId === "string"
        )
      );
    } catch {
      return defaultExpandedCategoryIds;
    }
  }, [defaultExpandedCategoryIds, storedValue]);
}

function subscribeToCategoryExpansionStorage(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener("oso:part-category-expansion", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("oso:part-category-expansion", onStoreChange);
  };
}

function readStoredExpandedCategoryIds(storageKey: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(storageKey);
}

function saveExpandedCategoryIds(
  storageKey: string,
  expandedCategoryIds: Set<string>
) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify(Array.from(expandedCategoryIds))
    );
    window.dispatchEvent(new Event("oso:part-category-expansion"));
  } catch {
    // Ignore unavailable local storage; the tree still works for this page load.
  }
}

function getCategoryAndDescendantIds(
  categories: PartCategoryListItem[],
  categoryId: string
) {
  const excludedIds = new Set([categoryId]);
  let changed = true;

  while (changed) {
    changed = false;

    for (const category of categories) {
      if (
        category.parentId &&
        excludedIds.has(category.parentId) &&
        !excludedIds.has(category.id)
      ) {
        excludedIds.add(category.id);
        changed = true;
      }
    }
  }

  return excludedIds;
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

function closeDialog(dialog: HTMLDialogElement | null) {
  if (!dialog?.open) {
    return;
  }

  dialog.close();
}

function getCategorySuccessMessage(
  actionLabel: string,
  category: PartCategoryListItem
) {
  return `${actionLabel}: ${category.name}.`;
}

function getCategoryErrorMessage(copy: Copy, error: string) {
  if (error === "missing-required-fields" || error === "category-name-required") {
    return copy.missingRequiredFields;
  }

  if (error === "invalid-parent-category") {
    return copy.invalidParentCategory;
  }

  if (error === "category-not-found") {
    return copy.categoryNotFound;
  }

  if (error === "category-tree-cycle") {
    return copy.categoryTreeCycle;
  }

  if (error === "workspace-permission-denied") {
    return copy.permissionDenied;
  }

  return copy.databaseUnavailable;
}
