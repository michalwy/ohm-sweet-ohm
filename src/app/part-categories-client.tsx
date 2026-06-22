"use client";

import { useMutation } from "@tanstack/react-query";
import {
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";

import {
  createPartCategoryPathFromForm,
  createPartCategoryFromForm,
  deletePartCategoryFromForm,
  updatePartCategoryFromForm
} from "@/server/parts/categoryActions";
import type { PartCategoryListItem } from "@/server/parts/categories";
import {
  getEffectiveCategoryAttributesForWorkspace,
  getEffectiveWorkspaceAttributesForWorkspace,
  saveCategoryAttributeConfigurationForWorkspace,
  saveWorkspaceAttributeConfigurationForWorkspace
} from "@/server/parts/attributeActions";
import type { AttributeListItem } from "@/server/parts/attributeMutations";
import type { EffectiveCategoryAttribute } from "@/server/parts/attributes";
import { WORKSPACE_ATTRIBUTE_SOURCE_ID } from "@/lib/part-attribute-sources";
import {
  getNextToastId,
  ToastNotice,
  type ToastMessage
} from "@/app/toast-notice";
import {
  buildTree,
  getAncestorIds,
  getExpandableIds,
  getFloatingPanelStyle,
  getVisibleOptions,
  type TreeNode
} from "@/app/tree-picker-utils";
import {
  DeleteConfirmationDialog,
  DialogBody,
  DialogFooter,
  DialogShell,
  ErrorBubble,
  LabelWithError,
  closeDialog,
  getFieldInputClassName,
  getDialogBodyHeightStyle,
  observeDialogContentHeight,
  openDialog
} from "@/app/dialog-shell";

type Copy = {
  title: string;
  addRootCategory: string;
  quickCreatePath: string;
  quickCreatePathTitle: string;
  quickCreatePathBody: string;
  path: string;
  pathPlaceholder: string;
  addChild: string;
  edit: string;
  delete: string;
  configureAttributes: string;
  categoryAttributes: string;
  detailsTab: string;
  attributesTab: string;
  createCategoryBeforeAttributes: string;
  attribute: string;
  sortOrder: string;
  defaultValue: string;
  valueAttribute: string;
  primaryAttribute: string;
  inherited: string;
  local: string;
  attachAttribute: string;
  globalAttributes: string;
  globalAttributesTitle: string;
  globalAttributesBody: string;
  saveGlobalAttributes: string;
  saveAttributeConfig: string;
  detachAttribute: string;
  noValueAttribute: string;
  noAttributes: string;
  selectCategory: string;
  expandCategory: string;
  collapseCategory: string;
  searchCategories: string;
  noMatchingCategories: string;
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
  cancelDelete: string;
  confirmDelete: string;
  deleteConfirmationBody: string;
  createdToast: string;
  updatedToast: string;
  deletedToast: string;
  attributeConfigUpdatedToast: string;
  attributeConfigDeletedToast: string;
  valueAttributeUpdatedToast: string;
  missingRequiredFields: string;
  invalidParentCategory: string;
  categoryNotFound: string;
  categoryTreeCycle: string;
  categoryInUseByParts: string;
  categoryHasChildren: string;
  permissionDenied: string;
  invalidAttributeDefaultValue: string;
  emptyTitle: string;
  emptyBody: string;
  databaseUnavailable: string;
};

type CategoryTreeItem = TreeNode<PartCategoryListItem>;

type CategoryDialogMode = "create" | "edit";
type CategoryDialogTab = "details" | "attributes";
type CategoryFormField = "name" | "parentId" | "submit" | "delete";
type CategoryFormErrors = Partial<Record<CategoryFormField, string>>;

type CategoryDialogSubmitInput = {
  formData: FormData;
  attributeDrafts: CategoryAttributeDraft[];
  valueAttributeId: string;
};

type PartCategoriesClientProps = {
  categories: PartCategoryListItem[];
  categoryDialogOpen: boolean;
  categoryEditDialog?: string;
  copy: Copy;
  isDatabaseAvailable: boolean;
  canWriteCategories: boolean;
  attributes: AttributeListItem[];
  workspaceSlug: string;
};

export function PartCategoriesClient({
  categories,
  categoryDialogOpen,
  categoryEditDialog,
  copy,
  isDatabaseAvailable,
  canWriteCategories,
  attributes,
  workspaceSlug
}: PartCategoriesClientProps) {
  const categoryDialogRef = useRef<HTMLDialogElement>(null);
  const quickPathDialogRef = useRef<HTMLDialogElement>(null);
  const globalAttributesDialogRef = useRef<HTMLDialogElement>(null);
  const nextToastIdRef = useRef(0);
  const [currentCategories, setCurrentCategories] = useState(categories);
  const [categoryDialogMode, setCategoryDialogMode] =
    useState<CategoryDialogMode | null>(null);
  const [activeCategoryDialogTab, setActiveCategoryDialogTab] =
    useState<CategoryDialogTab>("details");
  const [createParentId, setCreateParentId] = useState("");
  const [editingCategory, setEditingCategory] =
    useState<PartCategoryListItem | null>(() =>
      currentCategories.find((category) => category.id === categoryEditDialog) ??
      null
    );
  const [categoryPendingDelete, setCategoryPendingDelete] =
    useState<PartCategoryListItem | null>(null);
  const [createCategoryAttributeDrafts, setCreateCategoryAttributeDrafts] =
    useState<CategoryAttributeDraft[]>([]);
  const [createCategoryValueAttributeId, setCreateCategoryValueAttributeId] =
    useState("");
  const [createFormResetKey, setCreateFormResetKey] = useState(0);
  const [quickPathError, setQuickPathError] = useState<string | null>(null);
  const [isGlobalAttributesDialogOpen, setIsGlobalAttributesDialogOpen] =
    useState(false);
  const [globalAttributeDrafts, setGlobalAttributeDrafts] = useState<
    CategoryAttributeDraft[]
  >([]);
  const [globalFieldError, setGlobalFieldError] = useState<string | null>(null);
  const [categoryFieldErrors, setCategoryFieldErrors] =
    useState<CategoryFormErrors>({});
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const categoryTree = useMemo(
    () => buildTree(currentCategories),
    [currentCategories]
  );
  const categoryExpansionStorageKey = `oso:${workspaceSlug}:part-category-expansion`;
  const defaultExpandedCategoryIds = useMemo(
    () => getExpandableIds(categoryTree),
    [categoryTree]
  );
  const expansionInteractedRef = useRef(false);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(
    defaultExpandedCategoryIds
  );
  const createCategoryMutation = useMutation({
    mutationFn: ({ formData }: CategoryDialogSubmitInput) =>
      createPartCategoryFromForm(formData),
    onError: () => {
      setCategoryFieldErrors({
        submit: getCategoryErrorMessage(copy, "database-unavailable")
      });
    },
    onSuccess: async (result, variables) => {
      if (!result.ok) {
        setCategoryFieldErrors(getCategoryFormErrors(copy, result.error));
        setCategoryPendingDelete(null);
        return;
      }

      if (
        variables.attributeDrafts.length > 0 ||
        variables.valueAttributeId
      ) {
        const configResult = await saveCategoryAttributeConfigurationForWorkspace({
          workspaceSlug,
          categoryId: result.category.id,
          valueAttributeId: variables.valueAttributeId || null,
          attributes: getLocalCategoryAttributeInputs(
            variables.attributeDrafts,
            result.category.id
          )
        });

        if (!configResult.ok) {
          setCurrentCategories(result.categories);
          setEditingCategory(result.category);
          setCategoryDialogMode("edit");
          setActiveCategoryDialogTab("attributes");
          setCategoryFieldErrors(getCategoryFormErrors(copy, configResult.error));
          return;
        }
      }

      setCurrentCategories(result.categories);
      if (result.category.parentId) {
        setExpandedCategoryIds((currentIds) => {
          const nextIds = new Set(currentIds);
          nextIds.add(result.category.parentId as string);
          saveExpandedCategoryIds(categoryExpansionStorageKey, nextIds);
          return nextIds;
        });
      }
      setCreateParentId("");
      setCreateCategoryAttributeDrafts([]);
      setCreateCategoryValueAttributeId("");
      setCreateFormResetKey((currentKey) => currentKey + 1);
      setCategoryFieldErrors({});
      addToastMessage({
        id: getNextToastId(nextToastIdRef),
        message: getCategorySuccessMessage(copy.createdToast, result.category)
      });
      closeCategoryDialog();
    }
  });
  const createCategoryPathMutation = useMutation({
    mutationFn: createPartCategoryPathFromForm,
    onError: () => {
      setQuickPathError(getCategoryErrorMessage(copy, "database-unavailable"));
    },
    onSuccess: (result) => {
      if (!result.ok) {
        setQuickPathError(getCategoryErrorMessage(copy, result.error));
        return;
      }

      setCurrentCategories(result.categories);
      setQuickPathError(null);
      addToastMessage({
        id: getNextToastId(nextToastIdRef),
        message: getCategorySuccessMessage(copy.createdToast, result.category)
      });
      closeDialog(quickPathDialogRef.current);
    }
  });

  useEffect(() => {
    window.requestAnimationFrame(() => {
      if (expansionInteractedRef.current) {
        return;
      }

      setExpandedCategoryIds(
        getInitialExpandedCategoryIds(
          categoryExpansionStorageKey,
          defaultExpandedCategoryIds
        )
      );
    });
  }, [categoryExpansionStorageKey, defaultExpandedCategoryIds]);
  const updateCategoryMutation = useMutation({
    mutationFn: ({ formData }: CategoryDialogSubmitInput) =>
      updatePartCategoryFromForm(formData),
    onError: () => {
      setCategoryFieldErrors({
        submit: getCategoryErrorMessage(copy, "database-unavailable")
      });
    },
    onSuccess: async (result, variables) => {
      if (!result.ok) {
        setCategoryFieldErrors(getCategoryFormErrors(copy, result.error));
        return;
      }

      const configResult = await saveCategoryAttributeConfigurationForWorkspace({
        workspaceSlug,
        categoryId: result.category.id,
        valueAttributeId: variables.valueAttributeId || null,
        attributes: getLocalCategoryAttributeInputs(
          variables.attributeDrafts,
          result.category.id
        )
      });

      if (!configResult.ok) {
        setCurrentCategories(result.categories);
        setEditingCategory(result.category);
        setActiveCategoryDialogTab("attributes");
        setCategoryFieldErrors(getCategoryFormErrors(copy, configResult.error));
        return;
      }

      setCurrentCategories(result.categories);
      setEditingCategory(result.category);
      setCategoryFieldErrors({});
      addToastMessage({
        id: getNextToastId(nextToastIdRef),
        message: getCategorySuccessMessage(copy.updatedToast, result.category)
      });
      closeCategoryDialog();
    }
  });
  const deleteCategoryMutation = useMutation({
    mutationFn: deletePartCategoryFromForm,
    onError: () => {
      setCategoryFieldErrors({
        delete: getCategoryErrorMessage(copy, "database-unavailable")
      });
    },
    onSuccess: (result) => {
      if (!result.ok) {
        setCategoryFieldErrors({
          delete: getCategoryErrorMessage(copy, result.error)
        });
        return;
      }

      const deletedCategoryName =
        currentCategories.find((category) => category.id === result.id)?.name ??
        editingCategory?.name ??
        "";

      setCurrentCategories(result.categories);
      setCategoryPendingDelete(null);
      setCategoryFieldErrors({});
      addToastMessage({
        id: getNextToastId(nextToastIdRef),
        message: `${copy.deletedToast}: ${deletedCategoryName}.`
      });
      closeCategoryDialog();
    }
  });
  const loadGlobalAttributesMutation = useMutation({
    mutationFn: getEffectiveWorkspaceAttributesForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) {
        setGlobalFieldError(getCategoryErrorMessage(copy, result.error));
        return;
      }

      setGlobalAttributeDrafts(
        result.data.map((attribute) =>
          toCategoryAttributeDraft(attribute, WORKSPACE_ATTRIBUTE_SOURCE_ID)
        )
      );
      setGlobalFieldError(null);
    },
    onError: () => {
      setGlobalFieldError(getCategoryErrorMessage(copy, "database-unavailable"));
    }
  });
  const saveGlobalAttributesMutation = useMutation({
    mutationFn: saveWorkspaceAttributeConfigurationForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) {
        setGlobalFieldError(getCategoryErrorMessage(copy, result.error));
        return;
      }

      setGlobalAttributeDrafts(
        result.data.map((attribute) =>
          toCategoryAttributeDraft(attribute, WORKSPACE_ATTRIBUTE_SOURCE_ID)
        )
      );
      setGlobalFieldError(null);
      closeDialog(globalAttributesDialogRef.current);
      setIsGlobalAttributesDialogOpen(false);
      addToastMessage({
        id: getNextToastId(nextToastIdRef),
        message: copy.attributeConfigUpdatedToast
      });
    },
    onError: () => {
      setGlobalFieldError(getCategoryErrorMessage(copy, "database-unavailable"));
    }
  });

  useEffect(() => {
    if (categoryDialogOpen) {
      window.requestAnimationFrame(() => {
        setCategoryDialogMode("create");
        setActiveCategoryDialogTab("details");
        openDialog(categoryDialogRef.current);
      });
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
      setCategoryDialogMode("edit");
      setActiveCategoryDialogTab("details");
      openDialog(categoryDialogRef.current);
    });
  }, [currentCategories, categoryEditDialog]);

  function openCreateDialog(parentId: string | null) {
    setCreateParentId(parentId ?? "");
    setEditingCategory(null);
    setCreateCategoryAttributeDrafts([]);
    setCreateCategoryValueAttributeId("");
    setCategoryDialogMode("create");
    setActiveCategoryDialogTab("details");
    setCategoryFieldErrors({});
    setCreateFormResetKey((currentKey) => currentKey + 1);

    if (parentId) {
      const nextIds = new Set(expandedCategoryIds);
      nextIds.add(parentId);
      saveExpandedCategoryIds(categoryExpansionStorageKey, nextIds);
    }

    window.requestAnimationFrame(() => openDialog(categoryDialogRef.current));
  }

  function openEditDialog(category: PartCategoryListItem) {
    setEditingCategory(category);
    setCategoryDialogMode("edit");
    setActiveCategoryDialogTab("details");
    setCategoryFieldErrors({});
    setCreateFormResetKey((currentKey) => currentKey + 1);
    window.requestAnimationFrame(() => openDialog(categoryDialogRef.current));
  }

  function handleCreateSubmit(
    event: FormEvent<HTMLFormElement>,
    attributeDrafts: CategoryAttributeDraft[],
    valueAttributeId: string
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fieldErrors = validateCategoryForm(copy, formData);

    setCategoryFieldErrors(fieldErrors);

    if (hasFieldErrors(fieldErrors)) {
      return;
    }

    createCategoryMutation.mutate({
      formData,
      attributeDrafts,
      valueAttributeId
    });
  }

  function handleUpdateSubmit(
    event: FormEvent<HTMLFormElement>,
    attributeDrafts: CategoryAttributeDraft[],
    valueAttributeId: string
  ) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const fieldErrors = validateCategoryForm(copy, formData);

    setCategoryFieldErrors(fieldErrors);

    if (hasFieldErrors(fieldErrors)) {
      return;
    }

    updateCategoryMutation.mutate({
      formData,
      attributeDrafts,
      valueAttributeId
    });
  }

  function confirmDeleteCategory() {
    if (!categoryPendingDelete) {
      return;
    }

    const formData = new FormData();
    formData.set("workspaceSlug", workspaceSlug);
    formData.set("id", categoryPendingDelete.id);
    setCategoryFieldErrors({});
    deleteCategoryMutation.mutate(formData);
  }

  function closeCategoryDialog() {
    closeDialog(categoryDialogRef.current);
    setCategoryDialogMode(null);
    setEditingCategory(null);
    setCreateCategoryAttributeDrafts([]);
    setCreateCategoryValueAttributeId("");
    setCategoryFieldErrors({});
    setActiveCategoryDialogTab("details");
  }

  function addToastMessage(toast: ToastMessage) {
    setToastMessages((currentMessages) => [...currentMessages, toast]);
  }

  function openQuickPathDialog() {
    setQuickPathError(null);
    window.requestAnimationFrame(() => openDialog(quickPathDialogRef.current));
  }

  function submitQuickPath(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const path = String(formData.get("path") ?? "").trim();

    if (!path) {
      setQuickPathError(copy.missingRequiredFields);
      return;
    }

    formData.set("workspaceSlug", workspaceSlug);
    formData.set("finalType", "assignable");
    createCategoryPathMutation.mutate(formData);
  }

  function openGlobalAttributesDialog() {
    setGlobalFieldError(null);
    loadGlobalAttributesMutation.mutate({
      workspaceSlug
    });
    setIsGlobalAttributesDialogOpen(true);
    window.requestAnimationFrame(() => openDialog(globalAttributesDialogRef.current));
  }

  function closeGlobalAttributesDialog() {
    setIsGlobalAttributesDialogOpen(false);
    setGlobalFieldError(null);
  }

  function saveGlobalAttributes() {
    saveGlobalAttributesMutation.mutate({
      workspaceSlug,
      attributes: getLocalCategoryAttributeInputs(
        globalAttributeDrafts,
        WORKSPACE_ATTRIBUTE_SOURCE_ID
      )
    });
  }

  function dismissToastMessage(toastId: number) {
    setToastMessages((currentMessages) =>
      currentMessages.filter((toast) => toast.id !== toastId)
    );
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
            className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            disabled={!isDatabaseAvailable || !canWriteCategories}
            type="button"
            onClick={openQuickPathDialog}
          >
            {copy.quickCreatePath}
          </button>
          <button
            className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            disabled={!isDatabaseAvailable || !canWriteCategories}
            type="button"
            onClick={openGlobalAttributesDialog}
          >
            {copy.globalAttributes}
          </button>
          <button
            className={primaryButtonClassName}
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
              <span className="h-3 w-3 rounded-sm border border-slate-400 bg-white" />
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
                  onDelete={(categoryToDelete) => {
                    setCategoryFieldErrors({});
                    setCategoryPendingDelete(categoryToDelete);
                  }}
                  onEdit={openEditDialog}
                  expandedCategoryIds={expandedCategoryIds}
                  onToggleExpanded={(categoryId) => {
                    expansionInteractedRef.current = true;
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
                    setExpandedCategoryIds(nextIds);
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
      {categoryFieldErrors.delete ? (
        <div className="mt-3">
          <ErrorBubble align="start">{categoryFieldErrors.delete}</ErrorBubble>
        </div>
      ) : null}

      <ToastNotice messages={toastMessages} onDismiss={dismissToastMessage} />

      <DialogShell
        ref={categoryDialogRef}
        closeLabel={copy.close}
        description={
          categoryDialogMode === "create"
            ? copy.newCategoryBody
            : copy.editCategoryBody
        }
        title={
          categoryDialogMode === "create"
            ? copy.newCategoryTitle
            : copy.editCategoryTitle
        }
        titleId="category-dialog-title"
        widthClassName="w-[min(56rem,calc(100vw-3rem))]"
        onClose={() => {
          setCategoryDialogMode(null);
          setEditingCategory(null);
          setActiveCategoryDialogTab("details");
        }}
      >
        {categoryDialogMode ? (
          <CategoryDialogContent
            key={`${categoryDialogMode}-${editingCategory?.id ?? "new"}-${createFormResetKey}`}
            activeTab={activeCategoryDialogTab}
            canWriteCategories={canWriteCategories}
            categories={currentCategories}
            copy={copy}
            createParentId={createParentId}
            errors={categoryFieldErrors}
            isDatabaseAvailable={isDatabaseAvailable}
            isPending={
              categoryDialogMode === "create"
                ? createCategoryMutation.isPending
                : updateCategoryMutation.isPending ||
                  deleteCategoryMutation.isPending
            }
            mode={categoryDialogMode}
            attributes={attributes}
            createAttributeDrafts={createCategoryAttributeDrafts}
            createValueAttributeId={createCategoryValueAttributeId}
            category={editingCategory}
            workspaceSlug={workspaceSlug}
            onCreateSubmit={handleCreateSubmit}
            onParentIdChange={setCreateParentId}
            onCreateAttributeDraftsChange={setCreateCategoryAttributeDrafts}
            onCreateValueAttributeIdChange={setCreateCategoryValueAttributeId}
            onTabChange={setActiveCategoryDialogTab}
            onError={(error) =>
              setCategoryFieldErrors(getCategoryFormErrors(copy, error))
            }
            onUpdateSubmit={handleUpdateSubmit}
            onCancel={closeCategoryDialog}
          />
        ) : null}
      </DialogShell>
      <DeleteConfirmationDialog
        body={copy.deleteConfirmationBody}
        cancelLabel={copy.cancelDelete}
        closeLabel={copy.close}
        confirmLabel={copy.confirmDelete}
        deleteLabel={copy.delete}
        isPending={deleteCategoryMutation.isPending}
        itemName={categoryPendingDelete?.name ?? ""}
        open={Boolean(categoryPendingDelete)}
        onCancel={() => setCategoryPendingDelete(null)}
        onConfirm={confirmDeleteCategory}
      />
      <DialogShell
        ref={quickPathDialogRef}
        closeLabel={copy.close}
        description={copy.quickCreatePathBody}
        title={copy.quickCreatePathTitle}
        titleId="quick-path-dialog-title"
        widthClassName="w-[min(36rem,calc(100vw-3rem))]"
        onClose={() => setQuickPathError(null)}
      >
        <form className="grid gap-3 p-5" onSubmit={submitQuickPath}>
          <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
          <label className="grid gap-2 text-sm font-medium text-slate-700">
            <LabelWithError error={quickPathError}>{copy.path}</LabelWithError>
            <input
              className={getFieldInputClassName(
                "min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
                Boolean(quickPathError)
              )}
              name="path"
              placeholder={copy.pathPlaceholder}
              required
              type="text"
            />
          </label>
          <DialogFooter className="items-center justify-end gap-3 px-0">
            <button
              className={primaryButtonClassName}
              disabled={
                !isDatabaseAvailable ||
                !canWriteCategories ||
                createCategoryPathMutation.isPending
              }
              type="submit"
            >
              {copy.createCategory}
            </button>
          </DialogFooter>
        </form>
      </DialogShell>
      <DialogShell
        ref={globalAttributesDialogRef}
        closeLabel={copy.close}
        description={copy.globalAttributesBody}
        title={copy.globalAttributesTitle}
        titleId="global-attributes-dialog-title"
        widthClassName="w-[min(56rem,calc(100vw-3rem))]"
        onClose={closeGlobalAttributesDialog}
      >
        {isGlobalAttributesDialogOpen ? (
          <>
            <DialogBody>
              <div className="grid gap-3 pr-1">
                <CategoryAttributesDraftEditor
                  canWriteCategories={canWriteCategories}
                  categoryId={WORKSPACE_ATTRIBUTE_SOURCE_ID}
                  copy={copy}
                  drafts={globalAttributeDrafts}
                  isDatabaseAvailable={isDatabaseAvailable}
                  attributes={attributes}
                  hideValueAttribute
                  valueAttributeId=""
                  onDraftsChange={setGlobalAttributeDrafts}
                  onValueAttributeIdChange={() => undefined}
                />
              </div>
            </DialogBody>
            <DialogFooter className="items-center justify-end gap-3">
              <div className="relative">
                <ErrorBubble>{globalFieldError}</ErrorBubble>
                <button
                  className={primaryButtonClassName}
                  disabled={
                    !isDatabaseAvailable ||
                    !canWriteCategories ||
                    loadGlobalAttributesMutation.isPending ||
                    saveGlobalAttributesMutation.isPending
                  }
                  type="button"
                  onClick={saveGlobalAttributes}
                >
                  {copy.saveGlobalAttributes}
                </button>
              </div>
            </DialogFooter>
          </>
        ) : null}
      </DialogShell>
    </>
  );
}

function CategoryDialogContent({
  activeTab,
  canWriteCategories,
  categories,
  category,
  copy,
  createParentId,
  errors,
  isDatabaseAvailable,
  isPending,
  mode,
  attributes,
  createAttributeDrafts,
  createValueAttributeId,
  workspaceSlug,
  onCreateSubmit,
  onParentIdChange,
  onCreateAttributeDraftsChange,
  onCreateValueAttributeIdChange,
  onTabChange,
  onError,
  onUpdateSubmit,
  onCancel
}: {
  activeTab: CategoryDialogTab;
  canWriteCategories: boolean;
  categories: PartCategoryListItem[];
  category: PartCategoryListItem | null;
  copy: Copy;
  createParentId: string;
  errors: CategoryFormErrors;
  isDatabaseAvailable: boolean;
  isPending: boolean;
  mode: CategoryDialogMode;
  attributes: AttributeListItem[];
  createAttributeDrafts: CategoryAttributeDraft[];
  createValueAttributeId: string;
  workspaceSlug: string;
  onCreateSubmit: (
    event: FormEvent<HTMLFormElement>,
    attributeDrafts: CategoryAttributeDraft[],
    valueAttributeId: string
  ) => void;
  onParentIdChange: (parentId: string) => void;
  onCreateAttributeDraftsChange: (drafts: CategoryAttributeDraft[]) => void;
  onCreateValueAttributeIdChange: (attributeId: string) => void;
  onTabChange: (tab: CategoryDialogTab) => void;
  onError: (error: string) => void;
  onUpdateSubmit: (
    event: FormEvent<HTMLFormElement>,
    attributeDrafts: CategoryAttributeDraft[],
    valueAttributeId: string
  ) => void;
  onCancel: () => void;
}) {
  const formId = "category-details-form";
  const [editAttributeDrafts, setEditAttributeDrafts] = useState<
    CategoryAttributeDraft[]
  >([]);
  const [editValueAttributeId, setEditValueAttributeId] = useState("");
  const editAttributeDraftsRef = useRef<CategoryAttributeDraft[]>([]);
  const editValueAttributeIdRef = useRef("");
  const detailsContentRef = useRef<HTMLDivElement>(null);
  const [detailsContentHeight, setDetailsContentHeight] = useState<
    number | null
  >(null);
  const [editAttributesLoaded, setEditAttributesLoaded] = useState(
    mode === "create"
  );
  const loadEffectiveAttributesMutation = useMutation({
    mutationFn: getEffectiveCategoryAttributesForWorkspace,
    onSuccess: (result, variables) => {
      if (!result.ok) {
        onError(result.error);
        setEditAttributesLoaded(false);
        return;
      }

      setEditDrafts(
        result.data.map((attribute) =>
          toCategoryAttributeDraft(attribute, variables.categoryId)
        )
      );
      setEditValueAttribute(
        result.data.find((attribute) => attribute.isValue)?.attribute.id ?? ""
      );
      setEditAttributesLoaded(true);
    },
    onError: () => {
      onError("database-unavailable");
      setEditAttributesLoaded(false);
    }
  });
  const loadCreateParentAttributesMutation = useMutation({
    mutationFn: getEffectiveCategoryAttributesForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) {
        onError(result.error);
        return;
      }

      onCreateAttributeDraftsChange(
        result.data.map((attribute) => toCategoryAttributeDraft(attribute, ""))
      );
      onCreateValueAttributeIdChange(
        result.data.find((attribute) => attribute.isValue)?.attribute.id ?? ""
      );
    },
    onError: () => {
      onError("database-unavailable");
    }
  });
  const loadCreateGlobalAttributesMutation = useMutation({
    mutationFn: getEffectiveWorkspaceAttributesForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) {
        onError(result.error);
        return;
      }

      onCreateAttributeDraftsChange(
        result.data.map((attribute) =>
          toCategoryAttributeDraft(attribute, WORKSPACE_ATTRIBUTE_SOURCE_ID)
        )
      );
      onCreateValueAttributeIdChange("");
    },
    onError: () => {
      onError("database-unavailable");
    }
  });
  const activeAttributeDrafts =
    mode === "create" ? createAttributeDrafts : editAttributeDrafts;
  const activeValueAttributeId =
    mode === "create" ? createValueAttributeId : editValueAttributeId;
  const areAttributeControlsEnabled = mode === "create" || editAttributesLoaded;
  const isSaveDisabled =
    !isDatabaseAvailable ||
    !canWriteCategories ||
    isPending ||
    (mode === "edit" && !editAttributesLoaded);

  useEffect(() => {
    if (mode !== "edit" || !category) {
      return;
    }

    loadEffectiveAttributesMutation.mutate({
      workspaceSlug,
      categoryId: category.id
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category?.id, mode, workspaceSlug]);

  useEffect(() => {
    if (mode !== "create") {
      return;
    }

    if (!createParentId) {
      loadCreateGlobalAttributesMutation.mutate({
        workspaceSlug
      });
      return;
    }

    loadCreateParentAttributesMutation.mutate({
      workspaceSlug,
      categoryId: createParentId
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createParentId, mode, workspaceSlug]);

  useLayoutEffect(() => {
    if (activeTab !== "details") {
      return undefined;
    }

    return observeDialogContentHeight(
      detailsContentRef.current,
      setDetailsContentHeight
    );
  }, [activeTab, category, mode]);

  function setActiveAttributeDrafts(update: CategoryAttributeDraftUpdate) {
    if (mode === "create") {
      onCreateAttributeDraftsChange(
        typeof update === "function" ? update(createAttributeDrafts) : update
      );
      return;
    }

    setEditDrafts(update);
  }

  function setActiveValueAttributeId(attributeId: string) {
    if (mode === "create") {
      onCreateValueAttributeIdChange(attributeId);
      return;
    }

    setEditValueAttribute(attributeId);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (mode === "create") {
      onCreateSubmit(event, createAttributeDrafts, createValueAttributeId);
      return;
    }

    onUpdateSubmit(
      event,
      editAttributeDraftsRef.current,
      editValueAttributeIdRef.current
    );
  }

  function setEditDrafts(update: CategoryAttributeDraftUpdate) {
    const nextDrafts =
      typeof update === "function"
        ? update(editAttributeDraftsRef.current)
        : update;

    editAttributeDraftsRef.current = nextDrafts;
    setEditAttributeDrafts(nextDrafts);
  }

  function setEditValueAttribute(attributeId: string) {
    editValueAttributeIdRef.current = attributeId;
    setEditValueAttributeId(attributeId);
  }

  const categoryDialogBodyStyle: CSSProperties = {
    ...(getDialogBodyHeightStyle(detailsContentHeight) ?? {}),
    minHeight: `${categoryDialogBodyMinHeightPx}px`
  };

  return (
    <>
      <div className="shrink-0 border-b border-slate-200 px-5">
        <div className="flex gap-2">
          <button
            className={`min-h-10 border-b-2 px-3 text-sm font-medium ${
              activeTab === "details"
                ? "border-[var(--color-accent)] text-slate-950"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            type="button"
            onClick={() => onTabChange("details")}
          >
            {copy.detailsTab}
          </button>
          <button
            className={`min-h-10 border-b-2 px-3 text-sm font-medium ${
              activeTab === "attributes"
                ? "border-[var(--color-accent)] text-slate-950"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
            type="button"
            onClick={() => onTabChange("attributes")}
          >
            {copy.attributesTab}
          </button>
        </div>
      </div>
      <DialogBody
        className="flex-[0_1_auto]"
        style={categoryDialogBodyStyle}
      >
        <div
          ref={detailsContentRef}
          className={
            activeTab === "details"
              ? "grid gap-3 pr-1"
              : "hidden"
          }
        >
          <form
            key={`${mode}-${category?.id ?? "new"}`}
            className="grid gap-3"
            id={formId}
            onSubmit={handleSubmit}
          >
            <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
            {mode === "edit" && category ? (
              <input name="id" type="hidden" value={category.id} />
            ) : null}
            <CategoryFormFields
              categories={categories}
              copy={copy}
              defaultIsAssignable={
                mode === "create"
                  ? createParentId !== ""
                  : category?.isAssignable ?? true
              }
              excludedCategoryId={category?.id}
              isDatabaseAvailable={isDatabaseAvailable}
              nameDefaultValue={category?.name ?? ""}
              parentId={mode === "create" ? createParentId : category?.parentId ?? ""}
              errors={errors}
              setParentId={mode === "create" ? onParentIdChange : undefined}
            />
          </form>
        </div>
        <div
          className={
            activeTab === "attributes"
              ? "pr-1"
              : "hidden"
          }
        >
          {areAttributeControlsEnabled ? (
            <CategoryAttributesDraftEditor
              canWriteCategories={canWriteCategories}
              categoryId={category?.id ?? ""}
              copy={copy}
              drafts={activeAttributeDrafts}
              isDatabaseAvailable={
                isDatabaseAvailable && areAttributeControlsEnabled
              }
              attributes={attributes}
              valueAttributeId={activeValueAttributeId}
              onDraftsChange={setActiveAttributeDrafts}
              onValueAttributeIdChange={setActiveValueAttributeId}
            />
          ) : (
            <p className="text-sm text-slate-500">Loading attributes...</p>
          )}
        </div>
      </DialogBody>
      <DialogFooter className="items-center justify-between gap-3">
        <button
          className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          type="button"
          onClick={onCancel}
        >
          {copy.cancelDelete}
        </button>
        <div className="relative">
          <ErrorBubble>{errors.submit}</ErrorBubble>
          <button
            className={primaryButtonClassName}
            disabled={isSaveDisabled}
            form={formId}
            type="submit"
          >
            {mode === "create" ? copy.createCategory : copy.saveChanges}
          </button>
        </div>
      </DialogFooter>
    </>
  );
}

type CategoryAttributeDraft = {
  attribute: AttributeListItem;
  sourceCategoryId: string;
  isLocal: boolean;
  sortOrder: number;
  defaultValue: string;
  isPrimary: boolean;
  inheritedDraft: CategoryAttributeDraft | null;
};

type CategoryAttributeDraftUpdate = SetStateAction<CategoryAttributeDraft[]>;

function CategoryAttributesDraftEditor({
  canWriteCategories,
  categoryId,
  copy,
  drafts,
  isDatabaseAvailable,
  attributes,
  hideValueAttribute = false,
  valueAttributeId,
  onDraftsChange,
  onValueAttributeIdChange
}: {
  canWriteCategories: boolean;
  categoryId: string;
  copy: Copy;
  drafts: CategoryAttributeDraft[];
  isDatabaseAvailable: boolean;
  attributes: AttributeListItem[];
  hideValueAttribute?: boolean;
  valueAttributeId: string;
  onDraftsChange: (update: CategoryAttributeDraftUpdate) => void;
  onValueAttributeIdChange: (attributeId: string) => void;
}) {
  const availableAttributes = attributes.filter(
    (attribute) =>
      !drafts.some((draft) => draft.attribute.id === attribute.id)
  );

  function updateDraft(
    attributeId: string,
    patch: Partial<
      Pick<CategoryAttributeDraft, "sortOrder" | "defaultValue" | "isPrimary">
    >
  ) {
    onDraftsChange((currentDrafts) =>
      currentDrafts.map((draft) => {
        if (draft.attribute.id !== attributeId) {
          return draft;
        }

        const inheritedDraft =
          draft.inheritedDraft ??
          (!draft.isLocal && draft.sourceCategoryId !== categoryId
            ? {
                ...draft,
                isLocal: false,
                inheritedDraft: null
              }
            : null);

        return { ...draft, ...patch, isLocal: true, inheritedDraft };
      })
    );
  }

  function handleAddAttribute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const attribute = attributes.find(
      (item) => item.id === getFormValue(formData, "attributeId")
    );

    if (!attribute) {
      return;
    }

    onDraftsChange((currentDrafts) => [
      ...currentDrafts,
      {
        attribute,
        sourceCategoryId: "",
        isLocal: true,
        sortOrder: Number(getFormValue(formData, "sortOrder") || "0"),
        defaultValue: getFormValue(formData, "defaultValue"),
        isPrimary: false,
        inheritedDraft: null
      }
    ]);
    event.currentTarget.reset();
  }

  function removeDraft(attributeId: string) {
    onDraftsChange((currentDrafts) =>
      currentDrafts.flatMap((draft) => {
        if (draft.attribute.id !== attributeId) {
          return [draft];
        }

        return draft.inheritedDraft ? [draft.inheritedDraft] : [];
      })
    );

    const removedDraft = drafts.find(
      (draft) => draft.attribute.id === attributeId
    );

    if (valueAttributeId === attributeId && !removedDraft?.inheritedDraft) {
      onValueAttributeIdChange("");
    }
  }

  return (
    <div className="grid gap-3">
      {!hideValueAttribute ? (
        <label className="grid max-w-sm gap-2 text-sm font-medium text-slate-700">
          {copy.valueAttribute}
          <select
            className={categoryAttributeInputClassName}
            disabled={!isDatabaseAvailable || !canWriteCategories}
            value={valueAttributeId}
            onChange={(event) =>
              onValueAttributeIdChange(event.currentTarget.value)
            }
          >
            <option value="">{copy.noValueAttribute}</option>
            {drafts.map((draft) => (
              <option key={draft.attribute.id} value={draft.attribute.id}>
                {draft.attribute.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <CategoryAttributeDraftList
        canWriteCategories={canWriteCategories}
        categoryId={categoryId}
        copy={copy}
        drafts={drafts}
        isDatabaseAvailable={isDatabaseAvailable}
        onRemove={removeDraft}
        onUpdate={updateDraft}
      />
      <CategoryAttributeAttachForm
        availableAttributes={availableAttributes}
        canWriteCategories={canWriteCategories}
        copy={copy}
        isDatabaseAvailable={isDatabaseAvailable}
        onSubmit={handleAddAttribute}
      />
    </div>
  );
}

function CategoryAttributeDraftList({
  canWriteCategories,
  categoryId,
  copy,
  drafts,
  isDatabaseAvailable,
  onRemove,
  onUpdate
}: {
  canWriteCategories: boolean;
  categoryId: string;
  copy: Copy;
  drafts: CategoryAttributeDraft[];
  isDatabaseAvailable: boolean;
  onRemove: (attributeId: string) => void;
  onUpdate: (
    attributeId: string,
    patch: Partial<
      Pick<CategoryAttributeDraft, "sortOrder" | "defaultValue" | "isPrimary">
    >
  ) => void;
}) {
  if (drafts.length === 0) {
    return <p className="text-sm text-slate-500">{copy.noAttributes}</p>;
  }

  return (
    <div className="grid gap-1">
      <div className="grid grid-cols-[minmax(0,1fr)_5.25rem_minmax(6.5rem,9rem)_5rem_6.5rem] gap-1.5 px-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">
        <span>{copy.attribute}</span>
        <span>{copy.sortOrder}</span>
        <span>{copy.defaultValue}</span>
        <span>{copy.primaryAttribute}</span>
        <span className="sr-only">{copy.detachAttribute}</span>
      </div>
      {drafts.map((draft) => (
        <div
          key={draft.attribute.id}
          className="grid grid-cols-[minmax(0,1fr)_5.25rem_minmax(6.5rem,9rem)_5rem_6.5rem] items-center gap-1.5 rounded-md border border-slate-200 bg-white px-1.5 py-1"
          data-testid="category-attribute-draft-row"
        >
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-slate-950">
              {draft.attribute.name}
            </p>
            <p className="text-[11px] text-slate-500">
              {draft.sourceCategoryId === categoryId || draft.isLocal
                ? copy.local
                : copy.inherited}
            </p>
          </div>
          <input
            aria-label={copy.sortOrder}
            className={categoryAttributeInputClassName}
            type="number"
            value={draft.sortOrder}
            onChange={(event) =>
              onUpdate(draft.attribute.id, {
                sortOrder: Number(event.currentTarget.value || "0")
              })
            }
          />
          <CategoryAttributeDefaultValueControl
            copy={copy}
            attribute={draft.attribute}
            value={draft.defaultValue}
            onChange={(defaultValue) =>
              onUpdate(draft.attribute.id, { defaultValue })
            }
          />
          <label className="flex items-center justify-center">
            <span className="sr-only">{copy.primaryAttribute}</span>
            <input
              checked={draft.isPrimary}
              className="h-3.5 w-3.5 rounded border-slate-300 text-slate-950 focus:ring-slate-400 disabled:cursor-not-allowed"
              disabled={!isDatabaseAvailable || !canWriteCategories}
              type="checkbox"
              onChange={(event) =>
                onUpdate(draft.attribute.id, {
                  isPrimary: event.currentTarget.checked
                })
              }
            />
          </label>
          <button
            className="min-h-8 min-w-24 whitespace-nowrap rounded-md border border-[var(--color-error-border)] bg-white px-2 py-1 text-xs font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            disabled={
              !isDatabaseAvailable ||
              !canWriteCategories ||
              (!draft.isLocal && draft.sourceCategoryId !== categoryId)
            }
            type="button"
            onClick={() => onRemove(draft.attribute.id)}
          >
            {copy.detachAttribute}
          </button>
        </div>
      ))}
    </div>
  );
}

function CategoryAttributeAttachForm({
  availableAttributes,
  canWriteCategories,
  copy,
  isDatabaseAvailable,
  onSubmit
}: {
  availableAttributes: AttributeListItem[];
  canWriteCategories: boolean;
  copy: Copy;
  isDatabaseAvailable: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [selectedAttributeId, setSelectedAttributeId] = useState(
    availableAttributes[0]?.id ?? ""
  );
  const selectedAttribute =
    availableAttributes.find((attribute) => attribute.id === selectedAttributeId) ??
    availableAttributes[0] ??
    null;

  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(7rem,10rem)_7rem] items-end gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-2"
      onSubmit={onSubmit}
    >
      <label className="grid gap-1 text-xs font-medium text-slate-600">
        {copy.attribute}
        <select
          className={categoryAttributeInputClassName}
          name="attributeId"
          required
          value={selectedAttribute?.id ?? ""}
          onChange={(event) => setSelectedAttributeId(event.currentTarget.value)}
        >
          {availableAttributes.map((attribute) => (
            <option key={attribute.id} value={attribute.id}>
              {attribute.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-600">
        {copy.sortOrder}
        <input
          className={categoryAttributeInputClassName}
          name="sortOrder"
          type="number"
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-600">
        {copy.defaultValue}
        <CategoryAttributeDefaultValueControl
          copy={copy}
          name="defaultValue"
          attribute={selectedAttribute}
        />
      </label>
      <button
        className={primaryButtonClassName}
        disabled={
          !isDatabaseAvailable ||
          !canWriteCategories ||
          availableAttributes.length === 0
        }
        type="submit"
      >
        {copy.attachAttribute}
      </button>
    </form>
  );
}

function CategoryAttributeDefaultValueControl({
  copy,
  name,
  attribute,
  value,
  onChange
}: {
  copy: Copy;
  name?: string;
  attribute: AttributeListItem | null;
  value?: string;
  onChange?: (defaultValue: string) => void;
}) {
  if (attribute?.type === "CHOICE") {
    return (
      <select
        aria-label={copy.defaultValue}
        className={categoryAttributeInputClassName}
        name={name}
        value={value}
        onChange={(event) => onChange?.(event.currentTarget.value)}
      >
        <option value="" />
        {attribute.choiceOptions.map((option) => (
          <option key={option.id} value={option.label}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (attribute?.type === "BOOLEAN") {
    return (
      <select
        aria-label={copy.defaultValue}
        className={categoryAttributeInputClassName}
        name={name}
        value={value}
        onChange={(event) => onChange?.(event.currentTarget.value)}
      >
        <option value="" />
        <option value="Yes">Yes</option>
        <option value="No">No</option>
      </select>
    );
  }

  return (
    <input
      aria-label={copy.defaultValue}
      className={categoryAttributeInputClassName}
      name={name}
      value={value}
      onChange={(event) => onChange?.(event.currentTarget.value)}
    />
  );
}

function getLocalCategoryAttributeInputs(
  drafts: CategoryAttributeDraft[],
  categoryId: string
) {
  return drafts
    .filter((draft) => draft.isLocal || draft.sourceCategoryId === categoryId)
    .map((draft) => ({
      attributeId: draft.attribute.id,
      sortOrder: draft.sortOrder,
      defaultValue: draft.defaultValue ? { rawValue: draft.defaultValue } : null,
      isPrimary: draft.isPrimary
    }));
}

function toCategoryAttributeDraft(
  effectiveAttribute: EffectiveCategoryAttribute,
  categoryId: string
): CategoryAttributeDraft {
  return {
    attribute: effectiveAttribute.attribute,
    sourceCategoryId: effectiveAttribute.sourceCategoryId,
    isLocal: effectiveAttribute.sourceCategoryId === categoryId,
    sortOrder: effectiveAttribute.sortOrder,
    defaultValue: effectiveAttribute.defaultValue?.displayValue ?? "",
    isPrimary: effectiveAttribute.isPrimary,
    inheritedDraft: effectiveAttribute.inheritedAttribute
      ? toCategoryAttributeDraft(effectiveAttribute.inheritedAttribute, categoryId)
      : null
  };
}

function CategoryNode({
  canWriteCategories,
  category,
  copy,
  isDatabaseAvailable,
  level,
  onAddChild,
  onDelete,
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
  onDelete: (category: PartCategoryListItem) => void;
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
            ? "border-slate-400 bg-white text-slate-950"
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
            aria-label={copy.edit}
            disabled={!isDatabaseAvailable || !canWriteCategories}
            type="button"
            onClick={() => onEdit(category)}
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
          <button
            className="min-h-9 rounded-md border border-[var(--color-error-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            aria-label={copy.delete}
            disabled={!isDatabaseAvailable || !canWriteCategories}
            type="button"
            onClick={() => onDelete(category)}
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
              onDelete={onDelete}
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
  errors,
  isDatabaseAvailable,
  nameDefaultValue,
  parentId,
  setParentId
}: {
  categories: PartCategoryListItem[];
  copy: Copy;
  defaultIsAssignable: boolean;
  excludedCategoryId?: string;
  errors: CategoryFormErrors;
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
  const [selectedParentId, setSelectedParentId] = useState(parentId);
  const parentCategoryTree = useMemo(
    () => buildTree(parentOptions),
    [parentOptions]
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedParentId(parentId);
  }, [parentId]);

  function handleParentChange(nextParentId: string) {
    setSelectedParentId(nextParentId);
    setParentId?.(nextParentId);
  }

  return (
    <>
      <label className="grid gap-2 text-sm font-medium text-slate-700">
        <LabelWithError error={errors.name}>{copy.name}</LabelWithError>
        <input
          aria-invalid={errors.name ? true : undefined}
          className={getFieldInputClassName(
            "min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
            Boolean(errors.name)
          )}
          defaultValue={nameDefaultValue}
          disabled={!isDatabaseAvailable}
          name="name"
          placeholder={copy.namePlaceholder}
          required
          type="text"
        />
      </label>
      <CategoryParentTreeSelect
        categories={parentOptions}
        categoryTree={parentCategoryTree}
        copy={copy}
        disabled={!isDatabaseAvailable}
        error={errors.parentId}
        label={copy.parentCategory}
        name="parentId"
        noSelectionLabel={copy.rootCategory}
        selectedId={selectedParentId}
        onSelectedIdChange={handleParentChange}
      />
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
            <span className="grid min-h-10 cursor-pointer place-items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition peer-checked:border-[var(--color-accent-border)] peer-checked:bg-[var(--color-accent-soft)] peer-focus:ring-2 peer-focus:ring-[var(--color-action-focus)] peer-disabled:cursor-not-allowed peer-disabled:bg-slate-50 peer-disabled:text-slate-400">
              {copy.assignable}
            </span>
          </label>
        </div>
      </fieldset>
    </>
  );
}

function CategoryParentTreeSelect({
  categories,
  categoryTree,
  copy,
  disabled,
  error,
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
  error?: string;
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
  const currentSelectedCategory = categories.find(
    (category) => category.id === selectedId
  );
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [activeCategoryId, setActiveCategoryId] = useState(selectedId);
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<Set<string>>(
    () => getAncestorIds(categories, selectedId)
  );
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase("en");
  const visibleTree = normalizedSearchQuery
    ? filterCategoryTree(categoryTree, normalizedSearchQuery)
    : categoryTree;
  const effectiveExpandedCategoryIds = normalizedSearchQuery
    ? getExpandableIds(visibleTree)
    : expandedCategoryIds;
  const visibleCategoryOptions = getVisibleOptions(
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

    setExpandedCategoryIds(getAncestorIds(categories, selectedId));
    setActiveCategoryId(selectedId);
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

    setSelectedCategory(activeCategory.id);
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
      <span id={labelId}>
        <LabelWithError error={error}>{label}</LabelWithError>
      </span>
      <input name={name} type="hidden" value={selectedId} />
      <button
        id={buttonId}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`${label} ${
          currentSelectedCategory?.path ?? noSelectionLabel
        }`}
        aria-invalid={error ? true : undefined}
        className={getFieldInputClassName(
          defaultCategorySelectButtonClassName,
          Boolean(error)
        )}
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
                    onChange={(event) => setSearchQuery(event.currentTarget.value)}
                    onKeyDown={handleComboboxKeyDown}
                  />
                </div>
                <div
                  aria-labelledby={labelId}
                  className="min-h-0 overflow-auto p-2"
                  role="listbox"
                >
                  <button
                    aria-selected={selectedId === ""}
                    className={`mb-1 grid min-h-9 w-full grid-cols-[1.75rem_1fr] items-center rounded-md px-2 py-1.5 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-slate-300 ${
                      activeCategoryId === ""
                        ? "bg-[var(--color-accent-soft)] font-semibold text-slate-950 hover:bg-[var(--color-accent-soft)]"
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
                        <CategoryParentTreeSelectNode
                          key={category.id}
                          category={category}
                          copy={copy}
                          expandedCategoryIds={effectiveExpandedCategoryIds}
                          activeCategoryId={activeCategoryId}
                          level={0}
                          selectedId={selectedId}
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

function CategoryParentTreeSelectNode({
  category,
  copy,
  expandedCategoryIds,
  activeCategoryId,
  level,
  selectedId,
  onSelect,
  onToggleExpanded
}: {
  category: CategoryTreeItem;
  copy: Copy;
  expandedCategoryIds: Set<string>;
  activeCategoryId: string;
  level: number;
  selectedId: string;
  onSelect: (categoryId: string) => void;
  onToggleExpanded: (categoryId: string) => void;
}) {
  const hasChildren = category.children.length > 0;
  const isExpanded = expandedCategoryIds.has(category.id);
  const isSelected = selectedId === category.id;
  const isActive = activeCategoryId === category.id;
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
          aria-selected={isSelected}
          className={`min-h-9 rounded-md px-2 py-1.5 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-slate-300 ${
            isActive
              ? "bg-[var(--color-accent-soft)] font-semibold text-slate-950 hover:bg-[var(--color-accent-soft)]"
              : "text-slate-700 hover:bg-slate-50"
          }`}
          role="option"
          type="button"
          onClick={() => onSelect(category.id)}
        >
          <span className="block truncate">{category.name}</span>
        </button>
      </div>
      {hasChildren && isExpanded ? (
        <ol className="mt-1 grid gap-1">
          {category.children.map((child) => (
            <CategoryParentTreeSelectNode
              key={child.id}
              category={child}
              copy={copy}
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

function getInitialExpandedCategoryIds(
  storageKey: string,
  defaultExpandedCategoryIds: Set<string>
) {
  const storedValue = readStoredExpandedCategoryIds(storageKey);

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

function getCategorySuccessMessage(
  actionLabel: string,
  category: PartCategoryListItem
) {
  return `${actionLabel}: ${category.name}.`;
}

function getFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function validateCategoryForm(copy: Copy, formData: FormData): CategoryFormErrors {
  return getFormValue(formData, "name")
    ? {}
    : { name: copy.missingRequiredFields };
}

function getCategoryFormErrors(copy: Copy, error: string): CategoryFormErrors {
  if (error === "missing-required-fields" || error === "category-name-required") {
    return { name: copy.missingRequiredFields };
  }

  if (error === "invalid-parent-category" || error === "category-tree-cycle") {
    return { parentId: getCategoryErrorMessage(copy, error) };
  }

  if (error === "category-in-use-by-parts" || error === "category-has-children") {
    return { delete: getCategoryErrorMessage(copy, error) };
  }

  return { submit: getCategoryErrorMessage(copy, error) };
}

function hasFieldErrors(errors: Record<string, string | undefined>) {
  return Object.values(errors).some(Boolean);
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

  if (error === "category-in-use-by-parts") {
    return copy.categoryInUseByParts;
  }

  if (error === "category-has-children") {
    return copy.categoryHasChildren;
  }

  if (error === "workspace-permission-denied") {
    return copy.permissionDenied;
  }

  if (
    error === "invalid-choice-value" ||
    error === "invalid-number-value" ||
    error === "invalid-quantity-value" ||
    error === "invalid-quantity-prefix" ||
    error === "invalid-quantity-unit" ||
    error === "invalid-boolean-value" ||
    error === "attribute-value-required" ||
    error === "quantity-unit-required"
  ) {
    return copy.invalidAttributeDefaultValue;
  }

  return copy.databaseUnavailable;
}

const categoryAttributeInputClassName =
  "min-h-9 min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const categoryDialogBodyMinHeightPx = 520;
const primaryButtonClassName =
  "min-h-9 rounded-md border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:border-[var(--color-action-primary-hover)] hover:bg-[var(--color-action-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-focus)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400";
const defaultCategorySelectButtonClassName =
  "grid min-h-11 grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-base text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
