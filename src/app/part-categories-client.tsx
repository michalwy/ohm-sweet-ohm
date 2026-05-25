"use client";

import { useMutation } from "@tanstack/react-query";
import {
  type FormEvent,
  type SetStateAction,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";

import {
  createPartCategoryFromForm,
  updatePartCategoryFromForm
} from "@/server/parts/categoryActions";
import type { PartCategoryListItem } from "@/server/parts/categories";
import {
  getEffectiveCategoryAttributesForWorkspace,
  saveCategoryAttributeConfigurationForWorkspace
} from "@/server/parts/attributeActions";
import type { AttributeListItem } from "@/server/parts/attributeMutations";
import type { EffectiveCategoryAttribute } from "@/server/parts/attributes";
import {
  getNextToastId,
  ToastNotice,
  type ToastMessage
} from "@/app/toast-notice";
import {
  DialogBody,
  DialogFooter,
  DialogShell,
  getDialogBodyHeightStyle,
  observeDialogContentHeight
} from "@/app/dialog-shell";

type Copy = {
  title: string;
  addRootCategory: string;
  addChild: string;
  edit: string;
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
  saveAttributeConfig: string;
  detachAttribute: string;
  noValueAttribute: string;
  noAttributes: string;
  selectCategory: string;
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
  attributeConfigUpdatedToast: string;
  attributeConfigDeletedToast: string;
  valueAttributeUpdatedToast: string;
  missingRequiredFields: string;
  invalidParentCategory: string;
  categoryNotFound: string;
  categoryTreeCycle: string;
  permissionDenied: string;
  invalidAttributeDefaultValue: string;
  emptyTitle: string;
  emptyBody: string;
  databaseUnavailable: string;
};

type CategoryTreeItem = PartCategoryListItem & {
  children: CategoryTreeItem[];
};

type CategoryDialogMode = "create" | "edit";
type CategoryDialogTab = "details" | "attributes";

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
  const [createCategoryAttributeDrafts, setCreateCategoryAttributeDrafts] =
    useState<CategoryAttributeDraft[]>([]);
  const [createCategoryValueAttributeId, setCreateCategoryValueAttributeId] =
    useState("");
  const [createFormResetKey, setCreateFormResetKey] = useState(0);
  const [categoryFormError, setCategoryFormError] = useState<string | null>(null);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const categoryTree = useMemo(
    () => buildCategoryTree(currentCategories),
    [currentCategories]
  );
  const categoryExpansionStorageKey = `oso:${workspaceSlug}:part-category-expansion`;
  const defaultExpandedCategoryIds = useMemo(
    () => getExpandableCategoryIds(categoryTree),
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
      setCategoryFormError("database-unavailable");
    },
    onSuccess: async (result, variables) => {
      if (!result.ok) {
        setCategoryFormError(result.error);
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
          setCategoryFormError(configResult.error);
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
      setCategoryFormError(null);
      addToastMessage({
        id: getNextToastId(nextToastIdRef),
        message: getCategorySuccessMessage(copy.createdToast, result.category)
      });
      closeCategoryDialog();
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
      setCategoryFormError("database-unavailable");
    },
    onSuccess: async (result, variables) => {
      if (!result.ok) {
        setCategoryFormError(result.error);
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
        setCategoryFormError(configResult.error);
        return;
      }

      setCurrentCategories(result.categories);
      setEditingCategory(result.category);
      setCategoryFormError(null);
      addToastMessage({
        id: getNextToastId(nextToastIdRef),
        message: getCategorySuccessMessage(copy.updatedToast, result.category)
      });
      closeCategoryDialog();
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
    setCreateFormResetKey((currentKey) => currentKey + 1);

    if (parentId) {
      const nextIds = new Set(expandedCategoryIds);
      nextIds.add(parentId);
      saveExpandedCategoryIds(categoryExpansionStorageKey, nextIds);
    }

    setCategoryFormError(null);
    window.requestAnimationFrame(() => openDialog(categoryDialogRef.current));
  }

  function openEditDialog(category: PartCategoryListItem) {
    setEditingCategory(category);
    setCategoryDialogMode("edit");
    setActiveCategoryDialogTab("details");
    setCategoryFormError(null);
    setCreateFormResetKey((currentKey) => currentKey + 1);
    window.requestAnimationFrame(() => openDialog(categoryDialogRef.current));
  }

  function handleCreateSubmit(
    event: FormEvent<HTMLFormElement>,
    attributeDrafts: CategoryAttributeDraft[],
    valueAttributeId: string
  ) {
    event.preventDefault();
    setCategoryFormError(null);
    createCategoryMutation.mutate({
      formData: new FormData(event.currentTarget),
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
    setCategoryFormError(null);
    updateCategoryMutation.mutate({
      formData: new FormData(event.currentTarget),
      attributeDrafts,
      valueAttributeId
    });
  }

  function closeCategoryDialog() {
    closeDialog(categoryDialogRef.current);
    setCategoryDialogMode(null);
    setEditingCategory(null);
    setCreateCategoryAttributeDrafts([]);
    setCreateCategoryValueAttributeId("");
    setCategoryFormError(null);
    setActiveCategoryDialogTab("details");
  }

  function addToastMessage(toast: ToastMessage) {
    setToastMessages((currentMessages) => [...currentMessages, toast]);
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
          setCategoryFormError(null);
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
            error={categoryFormError}
            isDatabaseAvailable={isDatabaseAvailable}
            isPending={
              categoryDialogMode === "create"
                ? createCategoryMutation.isPending
                : updateCategoryMutation.isPending
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
            onUpdateSubmit={handleUpdateSubmit}
          />
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
  error,
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
  onUpdateSubmit
}: {
  activeTab: CategoryDialogTab;
  canWriteCategories: boolean;
  categories: PartCategoryListItem[];
  category: PartCategoryListItem | null;
  copy: Copy;
  createParentId: string;
  error: string | null;
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
  onUpdateSubmit: (
    event: FormEvent<HTMLFormElement>,
    attributeDrafts: CategoryAttributeDraft[],
    valueAttributeId: string
  ) => void;
}) {
  const formId = "category-details-form";
  const [editAttributeDrafts, setEditAttributeDrafts] = useState<
    CategoryAttributeDraft[]
  >([]);
  const [editValueAttributeId, setEditValueAttributeId] = useState("");
  const editAttributeDraftsRef = useRef<CategoryAttributeDraft[]>([]);
  const editValueAttributeIdRef = useRef("");
  const detailsContentRef = useRef<HTMLFormElement>(null);
  const [detailsContentHeight, setDetailsContentHeight] = useState<
    number | null
  >(null);
  const [editAttributesError, setEditAttributesError] = useState<string | null>(
    null
  );
  const [editAttributesLoaded, setEditAttributesLoaded] = useState(
    mode === "create"
  );
  const loadEffectiveAttributesMutation = useMutation({
    mutationFn: getEffectiveCategoryAttributesForWorkspace,
    onSuccess: (result, variables) => {
      if (!result.ok) {
        setEditAttributesError(result.error);
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
      setEditAttributesError(null);
      setEditAttributesLoaded(true);
    },
    onError: () => {
      setEditAttributesError("database-unavailable");
      setEditAttributesLoaded(false);
    }
  });
  const loadCreateParentAttributesMutation = useMutation({
    mutationFn: getEffectiveCategoryAttributesForWorkspace,
    onSuccess: (result) => {
      if (!result.ok) {
        setEditAttributesError(result.error);
        return;
      }

      onCreateAttributeDraftsChange(
        result.data.map((attribute) => toCategoryAttributeDraft(attribute, ""))
      );
      onCreateValueAttributeIdChange(
        result.data.find((attribute) => attribute.isValue)?.attribute.id ?? ""
      );
      setEditAttributesError(null);
    },
    onError: () => {
      setEditAttributesError("database-unavailable");
    }
  });
  const activeAttributeDrafts =
    mode === "create" ? createAttributeDrafts : editAttributeDrafts;
  const activeValueAttributeId =
    mode === "create" ? createValueAttributeId : editValueAttributeId;
  const displayedError = error ?? editAttributesError;
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
      onCreateAttributeDraftsChange([]);
      onCreateValueAttributeIdChange("");
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
        style={getDialogBodyHeightStyle(detailsContentHeight)}
      >
        {displayedError ? (
          <p className="mb-3 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-soft)] px-3 py-2 text-sm text-[var(--color-error)]">
            {getCategoryErrorMessage(copy, displayedError)}
          </p>
        ) : null}
        <form
          key={`${mode}-${category?.id ?? "new"}`}
          ref={detailsContentRef}
          className={
            activeTab === "details"
              ? "grid gap-3 pr-1"
              : "hidden"
          }
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
            defaultIsAssignable={category?.isAssignable ?? true}
            excludedCategoryId={category?.id}
            isDatabaseAvailable={isDatabaseAvailable}
            nameDefaultValue={category?.name ?? ""}
            parentId={mode === "create" ? createParentId : category?.parentId ?? ""}
            setParentId={mode === "create" ? onParentIdChange : undefined}
          />
        </form>
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
      <DialogFooter>
        <button
          className={primaryButtonClassName}
          disabled={isSaveDisabled}
          form={formId}
          type="submit"
        >
          {mode === "create" ? copy.createCategory : copy.saveChanges}
        </button>
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
    <div className="grid gap-1.5">
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(7rem,10rem)_5.5rem_7rem] gap-2 px-1 text-xs font-medium text-slate-500">
        <span>{copy.attribute}</span>
        <span>{copy.sortOrder}</span>
        <span>{copy.defaultValue}</span>
        <span>{copy.primaryAttribute}</span>
        <span className="sr-only">{copy.detachAttribute}</span>
      </div>
      {drafts.map((draft) => (
        <div
          key={draft.attribute.id}
          className="grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(7rem,10rem)_5.5rem_7rem] items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5"
          data-testid="category-attribute-draft-row"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">
              {draft.attribute.name}
            </p>
            <p className="text-xs text-slate-500">
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
              className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400 disabled:cursor-not-allowed"
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
            className="min-h-9 min-w-28 whitespace-nowrap rounded-md border border-[var(--color-error-border)] bg-white px-2.5 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
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
            <span className="grid min-h-10 cursor-pointer place-items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition peer-checked:border-[var(--color-accent-border)] peer-checked:bg-[var(--color-accent-soft)] peer-focus:ring-2 peer-focus:ring-[var(--color-action-focus)] peer-disabled:cursor-not-allowed peer-disabled:bg-slate-50 peer-disabled:text-slate-400">
              {copy.assignable}
            </span>
          </label>
        </div>
      </fieldset>
    </>
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

function getFormValue(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
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
const primaryButtonClassName =
  "min-h-9 rounded-md border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:border-[var(--color-action-primary-hover)] hover:bg-[var(--color-action-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-focus)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400";
