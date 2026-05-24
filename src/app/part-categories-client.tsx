"use client";

import { useMutation } from "@tanstack/react-query";
import {
  type FormEvent,
  type SetStateAction,
  useEffect,
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
  getEffectiveCategoryParametersForWorkspace,
  saveCategoryParameterConfigurationForWorkspace
} from "@/server/parts/parameterActions";
import type { ParameterListItem } from "@/server/parts/parameterMutations";
import type { EffectiveCategoryParameter } from "@/server/parts/parameters";
import {
  getNextToastId,
  ToastNotice,
  type ToastMessage
} from "@/app/toast-notice";

type Copy = {
  title: string;
  addRootCategory: string;
  addChild: string;
  edit: string;
  configureParameters: string;
  categoryParameters: string;
  detailsTab: string;
  parametersTab: string;
  createCategoryBeforeParameters: string;
  parameter: string;
  sortOrder: string;
  defaultValue: string;
  valueParameter: string;
  primaryParameter: string;
  inherited: string;
  local: string;
  attachParameter: string;
  saveParameterConfig: string;
  detachParameter: string;
  noValueParameter: string;
  noParameters: string;
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
  parameterConfigUpdatedToast: string;
  parameterConfigDeletedToast: string;
  valueParameterUpdatedToast: string;
  missingRequiredFields: string;
  invalidParentCategory: string;
  categoryNotFound: string;
  categoryTreeCycle: string;
  permissionDenied: string;
  invalidParameterDefaultValue: string;
  emptyTitle: string;
  emptyBody: string;
  databaseUnavailable: string;
};

type CategoryTreeItem = PartCategoryListItem & {
  children: CategoryTreeItem[];
};

type CategoryDialogMode = "create" | "edit";
type CategoryDialogTab = "details" | "parameters";

type CategoryDialogSubmitInput = {
  formData: FormData;
  parameterDrafts: CategoryParameterDraft[];
  valueParameterId: string;
};

type PartCategoriesClientProps = {
  categories: PartCategoryListItem[];
  categoryDialogOpen: boolean;
  categoryEditDialog?: string;
  copy: Copy;
  isDatabaseAvailable: boolean;
  canWriteCategories: boolean;
  parameters: ParameterListItem[];
  workspaceSlug: string;
};

export function PartCategoriesClient({
  categories,
  categoryDialogOpen,
  categoryEditDialog,
  copy,
  isDatabaseAvailable,
  canWriteCategories,
  parameters,
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
  const [createCategoryParameterDrafts, setCreateCategoryParameterDrafts] =
    useState<CategoryParameterDraft[]>([]);
  const [createCategoryValueParameterId, setCreateCategoryValueParameterId] =
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
        variables.parameterDrafts.length > 0 ||
        variables.valueParameterId
      ) {
        const configResult = await saveCategoryParameterConfigurationForWorkspace({
          workspaceSlug,
          categoryId: result.category.id,
          valueParameterId: variables.valueParameterId || null,
          parameters: getLocalCategoryParameterInputs(
            variables.parameterDrafts,
            result.category.id
          )
        });

        if (!configResult.ok) {
          setCurrentCategories(result.categories);
          setEditingCategory(result.category);
          setCategoryDialogMode("edit");
          setActiveCategoryDialogTab("parameters");
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
      setCreateCategoryParameterDrafts([]);
      setCreateCategoryValueParameterId("");
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

      const configResult = await saveCategoryParameterConfigurationForWorkspace({
        workspaceSlug,
        categoryId: result.category.id,
        valueParameterId: variables.valueParameterId || null,
        parameters: getLocalCategoryParameterInputs(
          variables.parameterDrafts,
          result.category.id
        )
      });

      if (!configResult.ok) {
        setCurrentCategories(result.categories);
        setEditingCategory(result.category);
        setActiveCategoryDialogTab("parameters");
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
    setCreateCategoryParameterDrafts([]);
    setCreateCategoryValueParameterId("");
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
    parameterDrafts: CategoryParameterDraft[],
    valueParameterId: string
  ) {
    event.preventDefault();
    setCategoryFormError(null);
    createCategoryMutation.mutate({
      formData: new FormData(event.currentTarget),
      parameterDrafts,
      valueParameterId
    });
  }

  function handleUpdateSubmit(
    event: FormEvent<HTMLFormElement>,
    parameterDrafts: CategoryParameterDraft[],
    valueParameterId: string
  ) {
    event.preventDefault();
    setCategoryFormError(null);
    updateCategoryMutation.mutate({
      formData: new FormData(event.currentTarget),
      parameterDrafts,
      valueParameterId
    });
  }

  function closeCategoryDialog() {
    closeDialog(categoryDialogRef.current);
    setCategoryDialogMode(null);
    setEditingCategory(null);
    setCreateCategoryParameterDrafts([]);
    setCreateCategoryValueParameterId("");
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

      <dialog
        ref={categoryDialogRef}
        aria-labelledby="category-dialog-title"
        className="fixed inset-0 m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-4xl rounded-lg border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/40"
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
            parameters={parameters}
            createParameterDrafts={createCategoryParameterDrafts}
            createValueParameterId={createCategoryValueParameterId}
            category={editingCategory}
            workspaceSlug={workspaceSlug}
            onCreateSubmit={handleCreateSubmit}
            onParentIdChange={setCreateParentId}
            onCreateParameterDraftsChange={setCreateCategoryParameterDrafts}
            onCreateValueParameterIdChange={setCreateCategoryValueParameterId}
            onTabChange={setActiveCategoryDialogTab}
            onUpdateSubmit={handleUpdateSubmit}
          />
        ) : null}
      </dialog>
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
  parameters,
  createParameterDrafts,
  createValueParameterId,
  workspaceSlug,
  onCreateSubmit,
  onParentIdChange,
  onCreateParameterDraftsChange,
  onCreateValueParameterIdChange,
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
  parameters: ParameterListItem[];
  createParameterDrafts: CategoryParameterDraft[];
  createValueParameterId: string;
  workspaceSlug: string;
  onCreateSubmit: (
    event: FormEvent<HTMLFormElement>,
    parameterDrafts: CategoryParameterDraft[],
    valueParameterId: string
  ) => void;
  onParentIdChange: (parentId: string) => void;
  onCreateParameterDraftsChange: (drafts: CategoryParameterDraft[]) => void;
  onCreateValueParameterIdChange: (parameterId: string) => void;
  onTabChange: (tab: CategoryDialogTab) => void;
  onUpdateSubmit: (
    event: FormEvent<HTMLFormElement>,
    parameterDrafts: CategoryParameterDraft[],
    valueParameterId: string
  ) => void;
}) {
  const title = mode === "create" ? copy.newCategoryTitle : copy.editCategoryTitle;
  const body = mode === "create" ? copy.newCategoryBody : copy.editCategoryBody;
  const formId = "category-details-form";
  const [editParameterDrafts, setEditParameterDrafts] = useState<
    CategoryParameterDraft[]
  >([]);
  const [editValueParameterId, setEditValueParameterId] = useState("");
  const editParameterDraftsRef = useRef<CategoryParameterDraft[]>([]);
  const editValueParameterIdRef = useRef("");
  const [editParametersError, setEditParametersError] = useState<string | null>(
    null
  );
  const [editParametersLoaded, setEditParametersLoaded] = useState(
    mode === "create"
  );
  const loadEffectiveParametersMutation = useMutation({
    mutationFn: getEffectiveCategoryParametersForWorkspace,
    onSuccess: (result, variables) => {
      if (!result.ok) {
        setEditParametersError(result.error);
        setEditParametersLoaded(false);
        return;
      }

      setEditDrafts(
        result.data.map((parameter) =>
          toCategoryParameterDraft(parameter, variables.categoryId)
        )
      );
      setEditValueParameter(
        result.data.find((parameter) => parameter.isValue)?.parameter.id ?? ""
      );
      setEditParametersError(null);
      setEditParametersLoaded(true);
    },
    onError: () => {
      setEditParametersError("database-unavailable");
      setEditParametersLoaded(false);
    }
  });
  const activeParameterDrafts =
    mode === "create" ? createParameterDrafts : editParameterDrafts;
  const activeValueParameterId =
    mode === "create" ? createValueParameterId : editValueParameterId;
  const displayedError = error ?? editParametersError;
  const areParameterControlsEnabled = mode === "create" || editParametersLoaded;
  const isSaveDisabled =
    !isDatabaseAvailable ||
    !canWriteCategories ||
    isPending ||
    (mode === "edit" && !editParametersLoaded);

  useEffect(() => {
    if (mode !== "edit" || !category) {
      return;
    }

    loadEffectiveParametersMutation.mutate({
      workspaceSlug,
      categoryId: category.id
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category?.id, mode, workspaceSlug]);

  function setActiveParameterDrafts(update: CategoryParameterDraftUpdate) {
    if (mode === "create") {
      onCreateParameterDraftsChange(
        typeof update === "function" ? update(createParameterDrafts) : update
      );
      return;
    }

    setEditDrafts(update);
  }

  function setActiveValueParameterId(parameterId: string) {
    if (mode === "create") {
      onCreateValueParameterIdChange(parameterId);
      return;
    }

    setEditValueParameter(parameterId);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (mode === "create") {
      onCreateSubmit(event, createParameterDrafts, createValueParameterId);
      return;
    }

    onUpdateSubmit(
      event,
      editParameterDraftsRef.current,
      editValueParameterIdRef.current
    );
  }

  function setEditDrafts(update: CategoryParameterDraftUpdate) {
    const nextDrafts =
      typeof update === "function"
        ? update(editParameterDraftsRef.current)
        : update;

    editParameterDraftsRef.current = nextDrafts;
    setEditParameterDrafts(nextDrafts);
  }

  function setEditValueParameter(parameterId: string) {
    editValueParameterIdRef.current = parameterId;
    setEditValueParameterId(parameterId);
  }

  return (
    <div className="p-6">
      <DialogHeader
        body={body}
        closeLabel={copy.close}
        title={title}
        titleId="category-dialog-title"
      />
      <div className="mb-5 flex gap-2 border-b border-slate-200">
        <button
          className={`min-h-10 border-b-2 px-3 text-sm font-medium ${
            activeTab === "details"
              ? "border-slate-950 text-slate-950"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          type="button"
          onClick={() => onTabChange("details")}
        >
          {copy.detailsTab}
        </button>
        <button
          className={`min-h-10 border-b-2 px-3 text-sm font-medium ${
            activeTab === "parameters"
              ? "border-slate-950 text-slate-950"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
          type="button"
          onClick={() => onTabChange("parameters")}
        >
          {copy.parametersTab}
        </button>
      </div>
      {displayedError ? (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {getCategoryErrorMessage(copy, displayedError)}
        </p>
      ) : null}
      <form
        key={`${mode}-${category?.id ?? "new"}`}
        className={activeTab === "details" ? "grid gap-4" : "hidden"}
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
      {activeTab === "parameters" && areParameterControlsEnabled ? (
        <CategoryParametersDraftEditor
          canWriteCategories={canWriteCategories}
          categoryId={category?.id ?? ""}
          copy={copy}
          drafts={activeParameterDrafts}
          isDatabaseAvailable={isDatabaseAvailable && areParameterControlsEnabled}
          parameters={parameters}
          valueParameterId={activeValueParameterId}
          onDraftsChange={setActiveParameterDrafts}
          onValueParameterIdChange={setActiveValueParameterId}
        />
      ) : null}
      {activeTab === "parameters" && !areParameterControlsEnabled ? (
        <p className="text-sm text-slate-500">Loading parameters...</p>
      ) : null}
      <div className="mt-5 flex justify-end border-t border-slate-200 pt-5">
        <button
          className="min-h-11 rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          disabled={isSaveDisabled}
          form={formId}
          type="submit"
        >
          {mode === "create" ? copy.createCategory : copy.saveChanges}
        </button>
      </div>
    </div>
  );
}

type CategoryParameterDraft = {
  parameter: ParameterListItem;
  sourceCategoryId: string;
  isLocal: boolean;
  sortOrder: number;
  defaultValue: string;
  isPrimary: boolean;
  inheritedDraft: CategoryParameterDraft | null;
};

type CategoryParameterDraftUpdate = SetStateAction<CategoryParameterDraft[]>;

function CategoryParametersDraftEditor({
  canWriteCategories,
  categoryId,
  copy,
  drafts,
  isDatabaseAvailable,
  parameters,
  valueParameterId,
  onDraftsChange,
  onValueParameterIdChange
}: {
  canWriteCategories: boolean;
  categoryId: string;
  copy: Copy;
  drafts: CategoryParameterDraft[];
  isDatabaseAvailable: boolean;
  parameters: ParameterListItem[];
  valueParameterId: string;
  onDraftsChange: (update: CategoryParameterDraftUpdate) => void;
  onValueParameterIdChange: (parameterId: string) => void;
}) {
  const availableParameters = parameters.filter(
    (parameter) =>
      !drafts.some((draft) => draft.parameter.id === parameter.id)
  );

  function updateDraft(
    parameterId: string,
    patch: Partial<
      Pick<CategoryParameterDraft, "sortOrder" | "defaultValue" | "isPrimary">
    >
  ) {
    onDraftsChange((currentDrafts) =>
      currentDrafts.map((draft) => {
        if (draft.parameter.id !== parameterId) {
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

  function handleAddParameter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const parameter = parameters.find(
      (item) => item.id === getFormValue(formData, "parameterId")
    );

    if (!parameter) {
      return;
    }

    onDraftsChange((currentDrafts) => [
      ...currentDrafts,
      {
        parameter,
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

  function removeDraft(parameterId: string) {
    onDraftsChange((currentDrafts) =>
      currentDrafts.flatMap((draft) => {
        if (draft.parameter.id !== parameterId) {
          return [draft];
        }

        return draft.inheritedDraft ? [draft.inheritedDraft] : [];
      })
    );

    const removedDraft = drafts.find(
      (draft) => draft.parameter.id === parameterId
    );

    if (valueParameterId === parameterId && !removedDraft?.inheritedDraft) {
      onValueParameterIdChange("");
    }
  }

  return (
    <div className="grid gap-3">
      <label className="grid max-w-sm gap-2 text-sm font-medium text-slate-700">
        {copy.valueParameter}
        <select
          className={categoryParameterInputClassName}
          disabled={!isDatabaseAvailable || !canWriteCategories}
          value={valueParameterId}
          onChange={(event) =>
            onValueParameterIdChange(event.currentTarget.value)
          }
        >
          <option value="">{copy.noValueParameter}</option>
          {drafts.map((draft) => (
            <option key={draft.parameter.id} value={draft.parameter.id}>
              {draft.parameter.name}
            </option>
          ))}
        </select>
      </label>
      <CategoryParameterDraftList
        canWriteCategories={canWriteCategories}
        categoryId={categoryId}
        copy={copy}
        drafts={drafts}
        isDatabaseAvailable={isDatabaseAvailable}
        onRemove={removeDraft}
        onUpdate={updateDraft}
      />
      <CategoryParameterAttachForm
        availableParameters={availableParameters}
        canWriteCategories={canWriteCategories}
        copy={copy}
        isDatabaseAvailable={isDatabaseAvailable}
        onSubmit={handleAddParameter}
      />
    </div>
  );
}

function CategoryParameterDraftList({
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
  drafts: CategoryParameterDraft[];
  isDatabaseAvailable: boolean;
  onRemove: (parameterId: string) => void;
  onUpdate: (
    parameterId: string,
    patch: Partial<
      Pick<CategoryParameterDraft, "sortOrder" | "defaultValue" | "isPrimary">
    >
  ) => void;
}) {
  if (drafts.length === 0) {
    return <p className="text-sm text-slate-500">{copy.noParameters}</p>;
  }

  return (
    <div className="grid gap-1.5">
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(7rem,10rem)_5.5rem_7rem] gap-2 px-1 text-xs font-medium text-slate-500">
        <span>{copy.parameter}</span>
        <span>{copy.sortOrder}</span>
        <span>{copy.defaultValue}</span>
        <span>{copy.primaryParameter}</span>
        <span className="sr-only">{copy.detachParameter}</span>
      </div>
      {drafts.map((draft) => (
        <div
          key={draft.parameter.id}
          className="grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(7rem,10rem)_5.5rem_7rem] items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5"
          data-testid="category-parameter-draft-row"
        >
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-950">
              {draft.parameter.name}
            </p>
            <p className="text-xs text-slate-500">
              {draft.sourceCategoryId === categoryId || draft.isLocal
                ? copy.local
                : copy.inherited}
            </p>
          </div>
          <input
            aria-label={copy.sortOrder}
            className={categoryParameterInputClassName}
            type="number"
            value={draft.sortOrder}
            onChange={(event) =>
              onUpdate(draft.parameter.id, {
                sortOrder: Number(event.currentTarget.value || "0")
              })
            }
          />
          <CategoryParameterDefaultValueControl
            copy={copy}
            parameter={draft.parameter}
            value={draft.defaultValue}
            onChange={(defaultValue) =>
              onUpdate(draft.parameter.id, { defaultValue })
            }
          />
          <label className="flex items-center justify-center">
            <span className="sr-only">{copy.primaryParameter}</span>
            <input
              checked={draft.isPrimary}
              className="h-4 w-4 rounded border-slate-300 text-slate-950 focus:ring-slate-400 disabled:cursor-not-allowed"
              disabled={!isDatabaseAvailable || !canWriteCategories}
              type="checkbox"
              onChange={(event) =>
                onUpdate(draft.parameter.id, {
                  isPrimary: event.currentTarget.checked
                })
              }
            />
          </label>
          <button
            className="min-h-9 min-w-28 whitespace-nowrap rounded-md border border-rose-200 bg-white px-2.5 py-1.5 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            disabled={
              !isDatabaseAvailable ||
              !canWriteCategories ||
              (!draft.isLocal && draft.sourceCategoryId !== categoryId)
            }
            type="button"
            onClick={() => onRemove(draft.parameter.id)}
          >
            {copy.detachParameter}
          </button>
        </div>
      ))}
    </div>
  );
}

function CategoryParameterAttachForm({
  availableParameters,
  canWriteCategories,
  copy,
  isDatabaseAvailable,
  onSubmit
}: {
  availableParameters: ParameterListItem[];
  canWriteCategories: boolean;
  copy: Copy;
  isDatabaseAvailable: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [selectedParameterId, setSelectedParameterId] = useState(
    availableParameters[0]?.id ?? ""
  );
  const selectedParameter =
    availableParameters.find((parameter) => parameter.id === selectedParameterId) ??
    availableParameters[0] ??
    null;

  return (
    <form
      className="grid grid-cols-[minmax(0,1fr)_5.5rem_minmax(7rem,10rem)_7rem] items-end gap-2 rounded-md border border-dashed border-slate-300 bg-slate-50 p-2"
      onSubmit={onSubmit}
    >
      <label className="grid gap-1 text-xs font-medium text-slate-600">
        {copy.parameter}
        <select
          className={categoryParameterInputClassName}
          name="parameterId"
          required
          value={selectedParameter?.id ?? ""}
          onChange={(event) => setSelectedParameterId(event.currentTarget.value)}
        >
          {availableParameters.map((parameter) => (
            <option key={parameter.id} value={parameter.id}>
              {parameter.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-600">
        {copy.sortOrder}
        <input
          className={categoryParameterInputClassName}
          name="sortOrder"
          type="number"
        />
      </label>
      <label className="grid gap-1 text-xs font-medium text-slate-600">
        {copy.defaultValue}
        <CategoryParameterDefaultValueControl
          copy={copy}
          name="defaultValue"
          parameter={selectedParameter}
        />
      </label>
      <button
        className="min-h-9 min-w-28 whitespace-nowrap rounded-md border border-slate-950 bg-slate-950 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
        disabled={
          !isDatabaseAvailable ||
          !canWriteCategories ||
          availableParameters.length === 0
        }
        type="submit"
      >
        {copy.attachParameter}
      </button>
    </form>
  );
}

function CategoryParameterDefaultValueControl({
  copy,
  name,
  parameter,
  value,
  onChange
}: {
  copy: Copy;
  name?: string;
  parameter: ParameterListItem | null;
  value?: string;
  onChange?: (defaultValue: string) => void;
}) {
  if (parameter?.type === "CHOICE") {
    return (
      <select
        aria-label={copy.defaultValue}
        className={categoryParameterInputClassName}
        name={name}
        value={value}
        onChange={(event) => onChange?.(event.currentTarget.value)}
      >
        <option value="" />
        {parameter.choiceOptions.map((option) => (
          <option key={option.id} value={option.label}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (parameter?.type === "BOOLEAN") {
    return (
      <select
        aria-label={copy.defaultValue}
        className={categoryParameterInputClassName}
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
      className={categoryParameterInputClassName}
      name={name}
      value={value}
      onChange={(event) => onChange?.(event.currentTarget.value)}
    />
  );
}

function getLocalCategoryParameterInputs(
  drafts: CategoryParameterDraft[],
  categoryId: string
) {
  return drafts
    .filter((draft) => draft.isLocal || draft.sourceCategoryId === categoryId)
    .map((draft) => ({
      parameterId: draft.parameter.id,
      sortOrder: draft.sortOrder,
      defaultValue: draft.defaultValue ? { rawValue: draft.defaultValue } : null,
      isPrimary: draft.isPrimary
    }));
}

function toCategoryParameterDraft(
  effectiveParameter: EffectiveCategoryParameter,
  categoryId: string
): CategoryParameterDraft {
  return {
    parameter: effectiveParameter.parameter,
    sourceCategoryId: effectiveParameter.sourceCategoryId,
    isLocal: effectiveParameter.sourceCategoryId === categoryId,
    sortOrder: effectiveParameter.sortOrder,
    defaultValue: effectiveParameter.defaultValue?.displayValue ?? "",
    isPrimary: effectiveParameter.isPrimary,
    inheritedDraft: effectiveParameter.inheritedParameter
      ? toCategoryParameterDraft(effectiveParameter.inheritedParameter, categoryId)
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
    error === "parameter-value-required" ||
    error === "quantity-unit-required"
  ) {
    return copy.invalidParameterDefaultValue;
  }

  return copy.databaseUnavailable;
}

const categoryParameterInputClassName =
  "min-h-9 min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
