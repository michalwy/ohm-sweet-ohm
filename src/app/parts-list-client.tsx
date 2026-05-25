"use client";

import type {
  CSSProperties,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent
} from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import { createPortal } from "react-dom";

import { createPart, deletePart, updatePart } from "@/server/parts/createPart";
import { getPartsListPageForWorkspace } from "@/server/parts/listActions";
import type { ManufacturerSuggestion } from "@/server/organizations/organizations";
import type { PartCategoryListItem } from "@/server/parts/categories";
import type { PartsListItem } from "@/server/parts/getParts";
import type { EffectiveCategoryAttribute } from "@/server/parts/attributes";
import { InfiniteListViewport } from "@/app/infinite-list";
import {
  getNextToastId,
  ToastNotice,
  type ToastMessage
} from "@/app/toast-notice";
import {
  DeleteConfirmationDialog,
  DialogBody,
  DialogFooter,
  DialogShell,
  getDialogBodyHeightStyle,
  observeDialogContentHeight
} from "@/app/dialog-shell";
import { useDebouncedValue } from "@/app/use-debounced-value";

type Copy = {
  title: string;
  detailsTab: string;
  attributesTab: string;
  catalogNumber: string;
  description: string;
  value: string;
  attributeValues: string;
  attributes: string;
  primaryAttributes: string;
  secondaryPrimaryAttributes: string;
  primaryCategoryAttributes: string;
  secondaryCategoryAttributes: string;
  categories: string;
  primaryCategory: string;
  secondaryCategory: string;
  noCategory: string;
  noSecondaryCategory: string;
  manufacturer: string;
  noMatchingManufacturers: string;
  searchParts: string;
  searchPartsPlaceholder: string;
  filterByCategory: string;
  allCategories: string;
  filterByManufacturer: string;
  allManufacturers: string;
  clearFilters: string;
  filteredPartsSummary: string;
  actions: string;
  newPartTitle: string;
  newPartBody: string;
  editPartTitle: string;
  editPartBody: string;
  catalogNumberPlaceholder: string;
  descriptionPlaceholder: string;
  manufacturerPlaceholder: string;
  categoryPlaceholder: string;
  searchCategories: string;
  noMatchingCategories: string;
  expandCategory: string;
  collapseCategory: string;
  createPart: string;
  editPart: string;
  deletePart: string;
  saveChanges: string;
  close: string;
  cancelDelete: string;
  confirmDelete: string;
  deleteConfirmationBody: string;
  addPart: string;
  createdToast: string;
  updatedToast: string;
  deletedToast: string;
  missingRequiredFields: string;
  invalidCategory: string;
  secondaryWithoutPrimary: string;
  duplicateCategories: string;
  duplicatePart: string;
  invalidAttributeValue: string;
  emptyTitle: string;
  emptyBody: string;
  noMatchingPartsTitle: string;
  noMatchingPartsBody: string;
  loadingParts: string;
  loadingMoreParts: string;
  databaseUnavailable: string;
};

type ListPage<TItem> = {
  items: TItem[];
  nextCursor: string | null;
  totalCount: number;
  filteredCount: number;
};

type CategoryTreeItem = PartCategoryListItem & {
  children: CategoryTreeItem[];
};

type PartDialogTab = "details" | "attributes";

type PartsListClientProps = {
  copy: Copy;
  isDatabaseAvailable: boolean;
  partDialogOpen: boolean;
  partEditDialog?: string;
  partCategories: PartCategoryListItem[];
  categoryAttributesByCategoryId: Record<string, EffectiveCategoryAttribute[]>;
  manufacturerSuggestions: ManufacturerSuggestion[];
  initialPage: ListPage<PartsListItem>;
  workspaceSlug: string;
};

export function PartsListClient({
  copy,
  isDatabaseAvailable,
  partDialogOpen,
  partEditDialog,
  partCategories,
  categoryAttributesByCategoryId,
  manufacturerSuggestions,
  initialPage,
  workspaceSlug
}: PartsListClientProps) {
  const queryClient = useQueryClient();
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const createDetailsContentRef = useRef<HTMLDivElement>(null);
  const editDetailsContentRef = useRef<HTMLDivElement>(null);
  const nextToastIdRef = useRef(0);
  const categoryTree = buildCategoryTree(partCategories);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilterId, setCategoryFilterId] = useState("");
  const [manufacturerFilter, setManufacturerFilter] = useState("");
  const [currentManufacturerSuggestions, setCurrentManufacturerSuggestions] =
    useState(manufacturerSuggestions);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const [createCatalogNumber, setCreateCatalogNumber] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createManufacturerName, setCreateManufacturerName] = useState("");
  const [createPrimaryCategoryId, setCreatePrimaryCategoryId] = useState("");
  const [createSecondaryCategoryId, setCreateSecondaryCategoryId] =
    useState("");
  const [createActiveTab, setCreateActiveTab] = useState<PartDialogTab>("details");
  const [createDetailsContentHeight, setCreateDetailsContentHeight] =
    useState<number | null>(null);
  const [createAttributeValues, setCreateAttributeValues] = useState<
    Record<string, string>
  >({});
  const [createFormResetKey, setCreateFormResetKey] = useState(0);
  const [editCatalogNumber, setEditCatalogNumber] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editManufacturerName, setEditManufacturerName] = useState("");
  const [editPrimaryCategoryId, setEditPrimaryCategoryId] = useState("");
  const [editSecondaryCategoryId, setEditSecondaryCategoryId] = useState("");
  const [editActiveTab, setEditActiveTab] = useState<PartDialogTab>("details");
  const [editDetailsContentHeight, setEditDetailsContentHeight] =
    useState<number | null>(null);
  const [editAttributeValues, setEditAttributeValues] = useState<
    Record<string, string>
  >({});
  const [editingPart, setEditingPart] = useState<PartsListItem | null>(null);
  const [partPendingDelete, setPartPendingDelete] =
    useState<PartsListItem | null>(null);
  const createHasAttributesTab =
    getPartAttributeGroups({
      categoryAttributesByCategoryId,
      copy,
      partCategories,
      selectedPrimaryCategoryId: createPrimaryCategoryId,
      selectedSecondaryCategoryId: createSecondaryCategoryId
    }).attributes.length > 0;
  const editHasAttributesTab =
    getPartAttributeGroups({
      categoryAttributesByCategoryId,
      copy,
      partCategories,
      selectedPrimaryCategoryId: editPrimaryCategoryId,
      selectedSecondaryCategoryId: editSecondaryCategoryId
    }).attributes.length > 0;
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [updateFormError, setUpdateFormError] = useState<string | null>(null);
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const debouncedManufacturerFilter = useDebouncedValue(manufacturerFilter, 300);
  const partsQueryKey = [
    "parts-list",
    workspaceSlug,
    {
      searchQuery: debouncedSearchQuery,
      categoryFilterId,
      manufacturerFilter: debouncedManufacturerFilter
    }
  ] as const;
  const partsQuery = useInfiniteQuery({
    queryKey: partsQueryKey,
    enabled: isDatabaseAvailable,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const result = await getPartsListPageForWorkspace({
        workspaceSlug,
        cursor: pageParam,
        searchQuery: debouncedSearchQuery,
        categoryFilterId,
        manufacturerFilter: debouncedManufacturerFilter
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.page;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialData:
      !debouncedSearchQuery &&
      !categoryFilterId &&
      !debouncedManufacturerFilter
        ? {
            pages: [initialPage],
            pageParams: [null]
          }
        : undefined
  });
  const currentParts = useMemo(
    () => partsQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [partsQuery.data]
  );
  const currentPartsById = useMemo(
    () => new Map(currentParts.map((part) => [part.id, part])),
    [currentParts]
  );
  const partsCounts = partsQuery.data?.pages[0] ?? initialPage;
  const manufacturerFilterOptions = useMemo(
    () =>
      currentManufacturerSuggestions
        .map((suggestion) => suggestion.name)
        .sort((left, right) =>
          left.localeCompare(right, "en", { sensitivity: "base" })
        ),
    [currentManufacturerSuggestions]
  );
  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    Boolean(categoryFilterId) ||
    Boolean(manufacturerFilter);
  async function refreshPartsLists() {
    await queryClient.invalidateQueries({
      queryKey: ["parts-list", workspaceSlug]
    });
  }
  const createPartMutation = useMutation({
    mutationFn: createPart,
    onError: () => {
      setCreateFormError("database-unavailable");
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        setCreateFormError(result.error);
        return;
      }

      await refreshPartsLists();
      addManufacturerSuggestion(result.part.manufacturerName);
      setCreateCatalogNumber("");
      setCreateDescription("");
      setCreateManufacturerName("");
      setCreatePrimaryCategoryId("");
      setCreateSecondaryCategoryId("");
      setCreateActiveTab("details");
      setCreateAttributeValues({});
      setCreateFormResetKey((currentKey) => currentKey + 1);
      addToastMessage({
        id: getNextToastId(nextToastIdRef),
        message: getPartSuccessMessage(copy.createdToast, result.part)
      });
      closeDialog(createDialogRef.current);
    }
  });
  const updatePartMutation = useMutation({
    mutationFn: updatePart,
    onError: () => {
      setUpdateFormError("database-unavailable");
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        setUpdateFormError(result.error);
        setPartPendingDelete(null);
        return;
      }

      await refreshPartsLists();
      addManufacturerSuggestion(result.part.manufacturerName);
      setEditingPart(result.part);
      setEditDescription(result.part.description ?? "");
      setEditManufacturerName(result.part.manufacturerName);
      setEditActiveTab("details");
      setEditAttributeValues(getPartAttributeValueState(result.part));
      addToastMessage({
        id: getNextToastId(nextToastIdRef),
        message: getPartSuccessMessage(copy.updatedToast, result.part)
      });
      closeDialog(editDialogRef.current);
    }
  });
  const deletePartMutation = useMutation({
    mutationFn: deletePart,
    onError: () => {
      setUpdateFormError("database-unavailable");
    },
    onSuccess: async (result) => {
      if (!result.ok) {
        setUpdateFormError(result.error);
        return;
      }

      const deletedPart =
        currentPartsById.get(result.id) ?? partPendingDelete ?? editingPart;
      await refreshPartsLists();
      setEditingPart(null);
      setPartPendingDelete(null);
      setUpdateFormError(null);

      if (deletedPart) {
        addToastMessage({
          id: getNextToastId(nextToastIdRef),
          message: getPartSuccessMessage(copy.deletedToast, deletedPart)
        });
      }

      closeDialog(editDialogRef.current);
    }
  });
  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<PartsListItem>();

    return [
      columnHelper.display({
        id: "categories",
        header: copy.categories,
        cell: ({ row }) => (
          <PartCategoriesSummary copy={copy} part={row.original} />
        )
      }),
      columnHelper.accessor("manufacturerName", {
        header: copy.manufacturer,
        cell: ({ getValue }) => (
          <span className="text-slate-950">{getValue()}</span>
        )
      }),
      columnHelper.accessor("catalogNumber", {
        header: copy.catalogNumber,
        cell: ({ getValue }) => (
          <span className="font-mono text-slate-950">{getValue()}</span>
        )
      }),
      columnHelper.accessor("description", {
        header: copy.description,
        cell: ({ getValue }) => {
          const value = getValue();

          return value ? (
            <span className="text-slate-700">{value}</span>
          ) : (
            <span className="text-slate-400">-</span>
          );
        }
      }),
      columnHelper.accessor("valueDisplayValue", {
        header: copy.value,
        cell: ({ getValue }) => {
          const value = getValue();

          return value ? (
            <span className="text-slate-950">{value}</span>
          ) : (
            <span className="text-slate-400">-</span>
          );
        }
      }),
      columnHelper.display({
        id: "actions",
        header: copy.actions,
        cell: ({ row }) => (
          <div className="text-right">
            <button
              className="min-h-8 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
              disabled={!isDatabaseAvailable}
              type="button"
              onClick={() => openEditDialog(row.original)}
            >
              {copy.editPart}
            </button>
          </div>
        )
      })
    ];
  }, [copy, isDatabaseAvailable]);
  // TanStack Table intentionally returns dynamic helpers that React Compiler cannot memoize.
  // eslint-disable-next-line react-hooks/incompatible-library
  const partsTable = useReactTable({
    data: currentParts,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  useEffect(() => {
    if (!createHasAttributesTab && createActiveTab === "attributes") {
      setCreateActiveTab("details");
    }
  }, [createActiveTab, createHasAttributesTab]);

  useEffect(() => {
    if (!editHasAttributesTab && editActiveTab === "attributes") {
      setEditActiveTab("details");
    }
  }, [editActiveTab, editHasAttributesTab]);

  useLayoutEffect(() => {
    if (createActiveTab !== "details") {
      return undefined;
    }

    return observeDialogContentHeight(
      createDetailsContentRef.current,
      setCreateDetailsContentHeight
    );
  }, [createActiveTab]);

  useLayoutEffect(() => {
    if (editActiveTab !== "details") {
      return undefined;
    }

    return observeDialogContentHeight(
      editDetailsContentRef.current,
      setEditDetailsContentHeight
    );
  }, [editActiveTab, editingPart]);

  useEffect(() => {
    if (partDialogOpen) {
      openDialog(createDialogRef.current);
    }
  }, [partDialogOpen]);

  useEffect(() => {
    if (!partEditDialog) {
      return;
    }

    const part = currentParts.find(
      (currentPart) => currentPart.id === partEditDialog
    );

    if (!part) {
      return;
    }

    window.requestAnimationFrame(() => {
      setEditingPart(part);
      setEditCatalogNumber(part.catalogNumber);
      setEditDescription(part.description ?? "");
      setEditManufacturerName(part.manufacturerName);
      setEditPrimaryCategoryId(part.primaryCategoryId ?? "");
      setEditSecondaryCategoryId(part.secondaryCategoryId ?? "");
      setEditAttributeValues(getPartAttributeValueState(part));
      setEditActiveTab("details");
      openDialog(editDialogRef.current);
    });
  }, [partEditDialog, currentParts]);

  function openEditDialog(part: PartsListItem) {
    setEditingPart(part);
    setEditCatalogNumber(part.catalogNumber);
    setEditDescription(part.description ?? "");
    setEditManufacturerName(part.manufacturerName);
    setEditPrimaryCategoryId(part.primaryCategoryId ?? "");
    setEditSecondaryCategoryId(part.secondaryCategoryId ?? "");
    setEditAttributeValues(getPartAttributeValueState(part));
    setEditActiveTab("details");
    setUpdateFormError(null);
    window.requestAnimationFrame(() => openDialog(editDialogRef.current));
  }

  function openCreateDialog() {
    setCreateCatalogNumber("");
    setCreateDescription("");
    setCreateManufacturerName("");
    setCreatePrimaryCategoryId("");
    setCreateSecondaryCategoryId("");
    setCreateActiveTab("details");
    setCreateAttributeValues({});
    setCreateFormResetKey((currentKey) => currentKey + 1);
    setCreateFormError(null);
    openDialog(createDialogRef.current);
  }

  function handleCreateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateFormError(null);
    createPartMutation.mutate(new FormData(event.currentTarget));
  }

  function handleUpdateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUpdateFormError(null);
    updatePartMutation.mutate(new FormData(event.currentTarget));
  }

  function handleDeletePart() {
    if (!editingPart) {
      return;
    }

    setPartPendingDelete(editingPart);
  }

  function confirmDeletePart() {
    if (!partPendingDelete) {
      return;
    }

    const formData = new FormData();
    formData.set("workspaceSlug", workspaceSlug);
    formData.set("id", partPendingDelete.id);
    setUpdateFormError(null);
    deletePartMutation.mutate(formData);
  }

  function addManufacturerSuggestion(manufacturerName: string) {
    setCurrentManufacturerSuggestions((currentSuggestions) => {
      if (
        currentSuggestions.some(
          (suggestion) => suggestion.name === manufacturerName
        )
      ) {
        return currentSuggestions;
      }

      return [
        ...currentSuggestions,
        { id: manufacturerName, name: manufacturerName }
      ].sort((left, right) =>
          left.name.localeCompare(right.name, "en", { sensitivity: "base" })
        );
    });
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
        aria-labelledby="parts-heading"
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      >
        <h2 id="parts-heading" className="sr-only">
          {copy.title}
        </h2>
        <div className="flex items-end gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <label className="grid min-w-72 gap-1.5 text-sm font-medium text-slate-700">
            {copy.searchParts}
            <input
              className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              placeholder={copy.searchPartsPlaceholder}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.currentTarget.value)}
            />
          </label>
          <div className="min-w-56">
            <CategoryTreeSelect
              allowOrganizationalCategories
              buttonClassName={compactCategorySelectButtonClassName}
              categories={partCategories}
              categoryTree={categoryTree}
              copy={copy}
              disabled={!isDatabaseAvailable}
              label={copy.filterByCategory}
              name="categoryFilterId"
              noSelectionLabel={copy.allCategories}
              selectedId={categoryFilterId}
              onSelectedIdChange={setCategoryFilterId}
            />
          </div>
          <ManufacturerAutocomplete
            compact
            copy={copy}
            disabled={!isDatabaseAvailable}
            inputId="manufacturer-filter"
            label={copy.filterByManufacturer}
            name="manufacturerFilter"
            placeholder={copy.allManufacturers}
            suggestions={manufacturerFilterOptions.map((manufacturerName) => ({
              id: manufacturerName,
              name: manufacturerName
            }))}
            value={manufacturerFilter}
            onValueChange={setManufacturerFilter}
          />
          <div className="flex min-h-9 items-center gap-3 pb-0.5">
            <p className="min-w-28 text-sm text-slate-500">
              {formatFilteredPartsSummary(copy, {
                total: partsCounts.totalCount,
                visible: partsCounts.filteredCount
              })}
            </p>
            {hasActiveFilters ? (
              <button
                className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setCategoryFilterId("");
                  setManufacturerFilter("");
                }}
              >
                {copy.clearFilters}
              </button>
            ) : null}
          </div>
          <div className="ml-auto pb-0.5">
            <button
              className={primaryButtonClassName}
              disabled={!isDatabaseAvailable}
              type="button"
              onClick={openCreateDialog}
            >
              {copy.addPart}
            </button>
          </div>
        </div>
        <InfiniteListViewport
          emptyState={
            <div className="px-4 py-10">
              <p className="text-base font-medium text-slate-950">
                {hasActiveFilters ? copy.noMatchingPartsTitle : copy.emptyTitle}
              </p>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                {hasActiveFilters ? copy.noMatchingPartsBody : copy.emptyBody}
              </p>
            </div>
          }
          errorState={
            <p className="p-6 text-sm text-slate-500">
              {copy.databaseUnavailable}
            </p>
          }
          hasNextPage={Boolean(partsQuery.hasNextPage)}
          isEmpty={currentParts.length === 0}
          isError={partsQuery.isError}
          isFetchingNextPage={partsQuery.isFetchingNextPage}
          isInitialLoading={partsQuery.isLoading}
          loadingLabel={copy.loadingParts}
          loadingMoreLabel={copy.loadingMoreParts}
          loadMore={() => {
            void partsQuery.fetchNextPage();
          }}
          testId="parts-list-viewport"
        >
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              {partsTable.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      scope="col"
                      className={`border-b border-slate-200 px-3 py-2 font-semibold text-slate-600 ${
                        header.column.id === "actions" ? "w-28 text-right" : ""
                      }`}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white">
              {partsTable.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 transition hover:bg-slate-50"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={`border-b border-slate-100 px-3 py-2 text-slate-700 ${
                        cell.column.id === "actions" ? "py-1.5" : ""
                      }`}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </InfiniteListViewport>
      </section>

      <ToastNotice messages={toastMessages} onDismiss={dismissToastMessage} />

      <DialogShell
        ref={createDialogRef}
        closeLabel={copy.close}
        description={copy.newPartBody}
        title={copy.newPartTitle}
        titleId="add-part-dialog-title"
        widthClassName="w-[min(58rem,calc(100vw-3rem))]"
        onCloseClick={() => setCreateFormError(null)}
      >
          <form
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
            onSubmit={handleCreateSubmit}
          >
            <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
            <PartAttributeHiddenInputs
              attributeValues={createAttributeValues}
              categoryAttributesByCategoryId={categoryAttributesByCategoryId}
              part={null}
              partCategories={partCategories}
              selectedPrimaryCategoryId={createPrimaryCategoryId}
              selectedSecondaryCategoryId={createSecondaryCategoryId}
            />
            <div className="shrink-0 border-b border-slate-200 px-5 pt-4">
              {createFormError ? (
                <p className="mb-3 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-soft)] px-3 py-2 text-sm text-[var(--color-error)]">
                  {createFormError === "missing-required-fields"
                    ? copy.missingRequiredFields
                    : getPartFormErrorMessage(copy, createFormError)}
                </p>
              ) : null}
              <PartDialogTabs
                activeTab={createActiveTab}
                copy={copy}
                showAttributesTab={createHasAttributesTab}
                onTabChange={setCreateActiveTab}
              />
            </div>
            <DialogBody
              className="flex-[0_1_auto]"
              style={getDialogBodyHeightStyle(createDetailsContentHeight)}
            >
              {createActiveTab === "details" ? (
                <div
                  ref={createDetailsContentRef}
                  className="grid gap-3 pr-1"
                >
                  <PartDetailsFields
                    catalogNumber={createCatalogNumber}
                    catalogNumberInputId="create-catalog-number"
                    categoryTree={categoryTree}
                    copy={copy}
                    disabled={!isDatabaseAvailable}
                    description={createDescription}
                    descriptionInputId="create-description"
                    formResetKey={createFormResetKey}
                    manufacturerInputId="create-manufacturer-name"
                    manufacturerName={createManufacturerName}
                    manufacturerSuggestions={currentManufacturerSuggestions}
                    partCategories={partCategories}
                    primaryCategoryId={createPrimaryCategoryId}
                    secondaryCategoryId={createSecondaryCategoryId}
                    onCatalogNumberChange={setCreateCatalogNumber}
                    onDescriptionChange={setCreateDescription}
                    onManufacturerNameChange={setCreateManufacturerName}
                    onPrimaryCategoryChange={(categoryId) => {
                      setCreatePrimaryCategoryId(categoryId);
                      setCreateSecondaryCategoryId("");
                    }}
                    onSecondaryCategoryChange={setCreateSecondaryCategoryId}
                  />
                  <PartAttributeSections
                    categoryAttributesByCategoryId={
                      categoryAttributesByCategoryId
                    }
                    partCategories={partCategories}
                    copy={copy}
                    disabled={!isDatabaseAvailable}
                    part={null}
                    selectedPrimaryCategoryId={createPrimaryCategoryId}
                    selectedSecondaryCategoryId={createSecondaryCategoryId}
                    tab="details"
                    values={createAttributeValues}
                    onValueChange={(attributeId, value) =>
                      setCreateAttributeValues((currentValues) => ({
                        ...currentValues,
                        [attributeId]: value
                      }))
                    }
                  />
                </div>
              ) : null}
              {createActiveTab === "attributes" ? (
                <div className="grid gap-3 pr-1">
                  <PartAttributeSections
                    categoryAttributesByCategoryId={
                      categoryAttributesByCategoryId
                    }
                    partCategories={partCategories}
                    copy={copy}
                    disabled={!isDatabaseAvailable}
                    part={null}
                    selectedPrimaryCategoryId={createPrimaryCategoryId}
                    selectedSecondaryCategoryId={createSecondaryCategoryId}
                    tab="attributes"
                    values={createAttributeValues}
                    onValueChange={(attributeId, value) =>
                      setCreateAttributeValues((currentValues) => ({
                        ...currentValues,
                        [attributeId]: value
                      }))
                    }
                  />
                </div>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <button
                className={primaryButtonClassName}
                type="submit"
                disabled={!isDatabaseAvailable || createPartMutation.isPending}
              >
                {copy.createPart}
              </button>
            </DialogFooter>
          </form>
      </DialogShell>

      <DialogShell
        ref={editDialogRef}
        closeLabel={copy.close}
        description={copy.editPartBody}
        title={copy.editPartTitle}
        titleId="edit-part-dialog-title"
        widthClassName="w-[min(58rem,calc(100vw-3rem))]"
        onCloseClick={() => setUpdateFormError(null)}
      >
          {editingPart ? (
            <form
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
              onSubmit={handleUpdateSubmit}
            >
              <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
              <input name="id" type="hidden" value={editingPart.id} />
              <PartAttributeHiddenInputs
                attributeValues={editAttributeValues}
                categoryAttributesByCategoryId={categoryAttributesByCategoryId}
                part={editingPart}
                partCategories={partCategories}
                selectedPrimaryCategoryId={editPrimaryCategoryId}
                selectedSecondaryCategoryId={editSecondaryCategoryId}
              />
              <div className="shrink-0 border-b border-slate-200 px-5 pt-4">
                {updateFormError ? (
                  <p className="mb-3 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-soft)] px-3 py-2 text-sm text-[var(--color-error)]">
                    {updateFormError === "missing-required-fields"
                      ? copy.missingRequiredFields
                      : getPartFormErrorMessage(copy, updateFormError)}
                  </p>
                ) : null}
                <PartDialogTabs
                  activeTab={editActiveTab}
                  copy={copy}
                  showAttributesTab={editHasAttributesTab}
                  onTabChange={setEditActiveTab}
                />
              </div>
              <DialogBody
                className="flex-[0_1_auto]"
                style={getDialogBodyHeightStyle(editDetailsContentHeight)}
              >
                {editActiveTab === "details" ? (
                  <div
                    ref={editDetailsContentRef}
                    className="grid gap-3 pr-1"
                  >
                    <PartDetailsFields
                      catalogNumber={editCatalogNumber}
                      catalogNumberInputId="edit-catalog-number"
                      categoryTree={categoryTree}
                      copy={copy}
                      disabled={!isDatabaseAvailable}
                      description={editDescription}
                      descriptionInputId="edit-description"
                      formResetKey={`${editingPart.id}-${editingPart.manufacturerName}`}
                      manufacturerInputId="edit-manufacturer-name"
                      manufacturerName={editManufacturerName}
                      manufacturerSuggestions={currentManufacturerSuggestions}
                      partCategories={partCategories}
                      primaryCategoryId={editPrimaryCategoryId}
                      secondaryCategoryId={editSecondaryCategoryId}
                      onCatalogNumberChange={setEditCatalogNumber}
                      onDescriptionChange={setEditDescription}
                      onManufacturerNameChange={setEditManufacturerName}
                      onPrimaryCategoryChange={(categoryId) => {
                        setEditPrimaryCategoryId(categoryId);

                        if (
                          !categoryId ||
                          editSecondaryCategoryId === categoryId
                        ) {
                          setEditSecondaryCategoryId("");
                        }
                      }}
                      onSecondaryCategoryChange={setEditSecondaryCategoryId}
                    />
                    <PartAttributeSections
                      categoryAttributesByCategoryId={
                        categoryAttributesByCategoryId
                      }
                      partCategories={partCategories}
                      copy={copy}
                      disabled={!isDatabaseAvailable}
                      part={editingPart}
                      selectedPrimaryCategoryId={editPrimaryCategoryId}
                      selectedSecondaryCategoryId={editSecondaryCategoryId}
                      tab="details"
                      values={editAttributeValues}
                      onValueChange={(attributeId, value) =>
                        setEditAttributeValues((currentValues) => ({
                          ...currentValues,
                          [attributeId]: value
                        }))
                      }
                    />
                  </div>
                ) : null}
                {editActiveTab === "attributes" ? (
                  <div className="grid gap-3 pr-1">
                    <PartAttributeSections
                      categoryAttributesByCategoryId={
                        categoryAttributesByCategoryId
                      }
                      partCategories={partCategories}
                      copy={copy}
                      disabled={!isDatabaseAvailable}
                      part={editingPart}
                      selectedPrimaryCategoryId={editPrimaryCategoryId}
                      selectedSecondaryCategoryId={editSecondaryCategoryId}
                      tab="attributes"
                      values={editAttributeValues}
                      onValueChange={(attributeId, value) =>
                        setEditAttributeValues((currentValues) => ({
                          ...currentValues,
                          [attributeId]: value
                        }))
                      }
                    />
                  </div>
                ) : null}
              </DialogBody>
              <DialogFooter className="items-center justify-between">
                <button
                  className="min-h-9 rounded-md border border-[var(--color-error-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                  disabled={!isDatabaseAvailable || deletePartMutation.isPending}
                  type="button"
                  onClick={handleDeletePart}
                >
                  {copy.deletePart}
                </button>
                <button
                  className={primaryButtonClassName}
                  type="submit"
                  disabled={
                    !isDatabaseAvailable ||
                    updatePartMutation.isPending ||
                    deletePartMutation.isPending
                  }
                >
                  {copy.saveChanges}
                </button>
              </DialogFooter>
            </form>
          ) : null}
      </DialogShell>
      <DeleteConfirmationDialog
        body={copy.deleteConfirmationBody}
        cancelLabel={copy.cancelDelete}
        closeLabel={copy.close}
        confirmLabel={copy.confirmDelete}
        deleteLabel={copy.deletePart}
        isPending={deletePartMutation.isPending}
        itemName={
          partPendingDelete
            ? `${partPendingDelete.manufacturerName} ${partPendingDelete.catalogNumber}`
            : ""
        }
        open={Boolean(partPendingDelete)}
        onCancel={() => setPartPendingDelete(null)}
        onConfirm={confirmDeletePart}
      />
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

function closeDialog(dialog: HTMLDialogElement | null) {
  if (!dialog?.open) {
    return;
  }

  dialog.close();
}

function getPartSuccessMessage(actionLabel: string, part: PartsListItem) {
  return `${actionLabel}: ${part.manufacturerName} ${part.catalogNumber}.`;
}

function getPartAttributeValueState(part: PartsListItem) {
  return Object.fromEntries(
    part.attributeValues.map((attributeValue) => [
      attributeValue.attributeId,
      attributeValue.displayValue
    ])
  );
}

function formatFilteredPartsSummary(
  copy: Pick<Copy, "filteredPartsSummary">,
  counts: { total: number; visible: number }
) {
  return copy.filteredPartsSummary
    .replace("{visible}", counts.visible.toLocaleString("en"))
    .replace("{total}", counts.total.toLocaleString("en"));
}

function getPartFormErrorMessage(copy: Copy, error: string) {
  if (error === "duplicate-part") {
    return copy.duplicatePart;
  }

  if (error === "invalid-category") {
    return copy.invalidCategory;
  }

  if (error === "secondary-without-primary") {
    return copy.secondaryWithoutPrimary;
  }

  if (error === "duplicate-categories") {
    return copy.duplicateCategories;
  }

  if (error === "invalid-attribute-value") {
    return copy.invalidAttributeValue;
  }

  return copy.databaseUnavailable;
}

function ManufacturerAutocomplete({
  compact = false,
  copy,
  disabled,
  inputId,
  label = copy.manufacturer,
  name,
  placeholder,
  suggestions,
  value,
  onValueChange
}: {
  compact?: boolean;
  copy: Copy;
  disabled: boolean;
  inputId: string;
  label?: string;
  name: string;
  placeholder: string;
  suggestions: ManufacturerSuggestion[];
  value: string;
  onValueChange: (value: string) => void;
}) {
  const listboxId = `${inputId}-suggestions`;
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const matchingSuggestions = getManufacturerMatches(value, suggestions);
  const hasSuggestions = matchingSuggestions.length > 0;
  const activeSuggestion = matchingSuggestions[activeIndex];
  const hasSearchQuery = normalizeManufacturerSearchText(value).length > 0;

  function updateSuggestionsOpen(nextValue: string) {
    if (!disabled && normalizeManufacturerSearchText(nextValue)) {
      setIsOpen(true);
      return;
    }

    setIsOpen(false);
  }

  function selectSuggestion(suggestion: ManufacturerSuggestion) {
    onValueChange(suggestion.name);
    setIsOpen(false);
    setActiveIndex(0);
  }

  function moveActiveSuggestion(direction: 1 | -1) {
    if (!hasSuggestions) {
      return;
    }

    setActiveIndex(
      (activeIndex + direction + matchingSuggestions.length) %
        matchingSuggestions.length
    );
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!isOpen) {
        updateSuggestionsOpen(value);
        return;
      }

      moveActiveSuggestion(1);
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (!isOpen) {
        updateSuggestionsOpen(value);
        return;
      }

      moveActiveSuggestion(-1);
    }

    if (event.key === "Enter" && isOpen && activeSuggestion) {
      event.preventDefault();
      selectSuggestion(activeSuggestion);
    }

    if (event.key === "Escape" && isOpen) {
      event.preventDefault();
      setIsOpen(false);
    }
  }

  return (
    <div
      className={`relative grid text-sm font-medium text-slate-700 ${
        compact ? "min-w-52 gap-1.5" : "gap-2"
      }`}
    >
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        aria-activedescendant={
          isOpen && activeSuggestion
            ? getManufacturerOptionId(inputId, activeSuggestion.id)
            : undefined
        }
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        autoComplete="off"
        className={`rounded-md border border-slate-300 bg-white px-3 text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 ${
          compact ? "min-h-9 py-1.5 text-sm" : "min-h-11 py-2 text-base"
        }`}
        disabled={disabled}
        name={name}
        placeholder={placeholder}
        role="combobox"
        type="text"
        value={value}
        onBlur={() => {
          setIsOpen(false);
        }}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;

          onValueChange(nextValue);
          setActiveIndex(0);
          updateSuggestionsOpen(nextValue);
        }}
        onKeyDown={handleKeyDown}
      />
      {isOpen && hasSearchQuery ? (
        <div
          id={listboxId}
          className="absolute left-0 right-0 top-full z-40 mt-1 overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg"
          role="listbox"
        >
          {hasSuggestions ? (
            <ol className="max-h-56 overflow-auto p-1">
              {matchingSuggestions.map((suggestion, index) => (
                <li key={suggestion.id}>
                  <button
                    id={getManufacturerOptionId(inputId, suggestion.id)}
                    aria-selected={index === activeIndex}
                    className={`min-h-9 w-full rounded-md px-3 py-1.5 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-slate-300 ${
                      index === activeIndex
                        ? "bg-[var(--color-accent-soft)] font-semibold text-slate-950"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                    role="option"
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectSuggestion(suggestion)}
                  >
                    {suggestion.name}
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="px-3 py-3 text-sm font-normal text-slate-500">
              {copy.noMatchingManufacturers}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function getManufacturerOptionId(inputId: string, suggestionId: string) {
  return `${inputId}-suggestion-${suggestionId}`;
}

function getManufacturerMatches(
  query: string,
  suggestions: ManufacturerSuggestion[]
) {
  const normalizedQuery = normalizeManufacturerSearchText(query);

  return suggestions
    .map((suggestion) => ({
      suggestion,
      score: scoreManufacturerMatch(normalizedQuery, suggestion.name)
    }))
    .filter((match) => match.score >= 0)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      return left.suggestion.name.localeCompare(right.suggestion.name, "en", {
        sensitivity: "base"
      });
    })
    .slice(0, 6)
    .map((match) => match.suggestion);
}

function scoreManufacturerMatch(query: string, manufacturerName: string) {
  const normalizedName = normalizeManufacturerSearchText(manufacturerName);

  if (!query) {
    return 1;
  }

  if (normalizedName === query) {
    return 100;
  }

  if (normalizedName.startsWith(query)) {
    return 80 - normalizedName.length / 100;
  }

  if (normalizedName.includes(query)) {
    return 60 - normalizedName.indexOf(query);
  }

  let queryIndex = 0;
  let score = 30;

  for (let nameIndex = 0; nameIndex < normalizedName.length; nameIndex += 1) {
    if (normalizedName[nameIndex] !== query[queryIndex]) {
      continue;
    }

    queryIndex += 1;
    score -= nameIndex / 100;

    if (queryIndex === query.length) {
      return score;
    }
  }

  return -1;
}

function normalizeManufacturerSearchText(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("en");
}

function PartDialogTabs({
  activeTab,
  copy,
  showAttributesTab,
  onTabChange
}: {
  activeTab: PartDialogTab;
  copy: Copy;
  showAttributesTab: boolean;
  onTabChange: (tab: PartDialogTab) => void;
}) {
  return (
    <div className="flex gap-2 border-b border-slate-200">
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
      {showAttributesTab ? (
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
      ) : null}
    </div>
  );
}

function PartDetailsFields({
  catalogNumber,
  catalogNumberInputId,
  categoryTree,
  copy,
  disabled,
  description,
  descriptionInputId,
  formResetKey,
  manufacturerInputId,
  manufacturerName,
  manufacturerSuggestions,
  partCategories,
  primaryCategoryId,
  secondaryCategoryId,
  onCatalogNumberChange,
  onDescriptionChange,
  onManufacturerNameChange,
  onPrimaryCategoryChange,
  onSecondaryCategoryChange
}: {
  catalogNumber: string;
  catalogNumberInputId: string;
  categoryTree: CategoryTreeItem[];
  copy: Copy;
  disabled: boolean;
  description: string;
  descriptionInputId: string;
  formResetKey: number | string;
  manufacturerInputId: string;
  manufacturerName: string;
  manufacturerSuggestions: ManufacturerSuggestion[];
  partCategories: PartCategoryListItem[];
  primaryCategoryId: string;
  secondaryCategoryId: string;
  onCatalogNumberChange: (catalogNumber: string) => void;
  onDescriptionChange: (description: string) => void;
  onManufacturerNameChange: (manufacturerName: string) => void;
  onPrimaryCategoryChange: (categoryId: string) => void;
  onSecondaryCategoryChange: (categoryId: string) => void;
}) {
  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <label
          className="grid gap-2 text-sm font-medium text-slate-700"
          htmlFor={catalogNumberInputId}
        >
          {copy.catalogNumber}
          <input
            className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            id={catalogNumberInputId}
            name="catalogNumber"
            placeholder={copy.catalogNumberPlaceholder}
            type="text"
            value={catalogNumber}
            disabled={disabled}
            onChange={(event) => onCatalogNumberChange(event.target.value)}
          />
        </label>
        <ManufacturerAutocomplete
          key={`manufacturer-${formResetKey}`}
          copy={copy}
          disabled={disabled}
          inputId={manufacturerInputId}
          value={manufacturerName}
          name="manufacturerName"
          placeholder={copy.manufacturerPlaceholder}
          suggestions={manufacturerSuggestions}
          onValueChange={onManufacturerNameChange}
        />
      </div>
      <label
        className="grid gap-2 text-sm font-medium text-slate-700"
        htmlFor={descriptionInputId}
      >
        {copy.description}
        <textarea
          className="min-h-20 resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
          id={descriptionInputId}
          name="description"
          placeholder={copy.descriptionPlaceholder}
          value={description}
          disabled={disabled}
          onChange={(event) => onDescriptionChange(event.target.value)}
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <CategoryTreeSelect
          categories={partCategories}
          categoryTree={categoryTree}
          copy={copy}
          disabled={disabled}
          label={copy.primaryCategory}
          name="primaryCategoryId"
          noSelectionLabel={copy.noCategory}
          selectedId={primaryCategoryId}
          onSelectedIdChange={onPrimaryCategoryChange}
        />
        <CategoryTreeSelect
          key={`secondary-${formResetKey}-${primaryCategoryId}`}
          categories={partCategories}
          categoryTree={categoryTree}
          copy={copy}
          disabled={disabled || !primaryCategoryId}
          excludedCategoryId={primaryCategoryId}
          label={copy.secondaryCategory}
          name="secondaryCategoryId"
          noSelectionLabel={copy.noSecondaryCategory}
          selectedId={secondaryCategoryId}
          onSelectedIdChange={onSecondaryCategoryChange}
        />
      </div>
    </div>
  );
}

function PartAttributeSections({
  categoryAttributesByCategoryId,
  copy,
  disabled,
  values,
  part,
  partCategories,
  selectedPrimaryCategoryId,
  selectedSecondaryCategoryId,
  tab,
  onValueChange
}: {
  categoryAttributesByCategoryId: Record<string, EffectiveCategoryAttribute[]>;
  copy: Copy;
  disabled: boolean;
  values: Record<string, string>;
  part: PartsListItem | null;
  partCategories: PartCategoryListItem[];
  selectedPrimaryCategoryId: string;
  selectedSecondaryCategoryId: string;
  tab: PartDialogTab;
  onValueChange: (attributeId: string, value: string) => void;
}) {
  const groups = getPartAttributeGroups({
    categoryAttributesByCategoryId,
    copy,
    partCategories,
    selectedPrimaryCategoryId,
    selectedSecondaryCategoryId
  });
  const sections = tab === "details" ? groups.details : groups.attributes;
  const existingValuesByAttributeId = new Map(
    (part?.attributeValues ?? []).map((attributeValue) => [
      attributeValue.attributeId,
      attributeValue.displayValue
    ])
  );

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3">
      {sections.map((section) => (
        <section key={section.id}>
          <h3 className="mb-2 text-sm font-semibold text-slate-700">
            {section.title}
          </h3>
          <div className="divide-y divide-slate-100 rounded-md border border-slate-200">
            {section.attributes.map((effectiveAttribute) => (
              <PartAttributeField
                key={effectiveAttribute.attribute.id}
                compact
                disabled={disabled}
                effectiveAttribute={effectiveAttribute}
                value={getAttributeInputValue({
                  effectiveAttribute,
                  existingValuesByAttributeId,
                  values
                })}
                onValueChange={onValueChange}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PartAttributeHiddenInputs({
  attributeValues,
  categoryAttributesByCategoryId,
  part,
  partCategories,
  selectedPrimaryCategoryId,
  selectedSecondaryCategoryId
}: {
  attributeValues: Record<string, string>;
  categoryAttributesByCategoryId: Record<string, EffectiveCategoryAttribute[]>;
  part: PartsListItem | null;
  partCategories: PartCategoryListItem[];
  selectedPrimaryCategoryId: string;
  selectedSecondaryCategoryId: string;
}) {
  const groups = getPartAttributeGroups({
    categoryAttributesByCategoryId,
    copy: null,
    partCategories,
    selectedPrimaryCategoryId,
    selectedSecondaryCategoryId
  });
  const existingValuesByAttributeId = new Map(
    (part?.attributeValues ?? []).map((attributeValue) => [
      attributeValue.attributeId,
      attributeValue.displayValue
    ])
  );
  const effectiveAttributesById = new Map<string, EffectiveCategoryAttribute>();

  for (const section of [...groups.details, ...groups.attributes]) {
    for (const effectiveAttribute of section.attributes) {
      effectiveAttributesById.set(
        effectiveAttribute.attribute.id,
        effectiveAttribute
      );
    }
  }

  return (
    <>
      {[...effectiveAttributesById.values()].map((effectiveAttribute) => (
        <input
          key={effectiveAttribute.attribute.id}
          name={`attributeValue:${effectiveAttribute.attribute.id}`}
          type="hidden"
          value={getAttributeInputValue({
            effectiveAttribute,
            existingValuesByAttributeId,
            values: attributeValues
          })}
        />
      ))}
    </>
  );
}

function getAttributeInputValue({
  effectiveAttribute,
  existingValuesByAttributeId,
  values
}: {
  effectiveAttribute: EffectiveCategoryAttribute;
  existingValuesByAttributeId: Map<string, string>;
  values: Record<string, string>;
}) {
  const attributeId = effectiveAttribute.attribute.id;

  return (
    values[attributeId] ??
    existingValuesByAttributeId.get(attributeId) ??
    effectiveAttribute.defaultValue?.displayValue ??
    ""
  );
}

function getPartAttributeGroups({
  categoryAttributesByCategoryId,
  copy,
  partCategories,
  selectedPrimaryCategoryId,
  selectedSecondaryCategoryId
}: {
  categoryAttributesByCategoryId: Record<string, EffectiveCategoryAttribute[]>;
  copy: Pick<Copy, "attributes" | "value"> | null;
  partCategories: PartCategoryListItem[];
  selectedPrimaryCategoryId: string;
  selectedSecondaryCategoryId: string;
}) {
  const primaryAttributes = selectedPrimaryCategoryId
    ? categoryAttributesByCategoryId[selectedPrimaryCategoryId] ?? []
    : [];
  const primaryAttributeIds = new Set(
    primaryAttributes.map((attribute) => attribute.attribute.id)
  );
  const secondaryAttributes = selectedSecondaryCategoryId
    ? (categoryAttributesByCategoryId[selectedSecondaryCategoryId] ?? []).filter(
        (attribute) => !primaryAttributeIds.has(attribute.attribute.id)
      )
    : [];
  const valueAttribute = primaryAttributes.find((attribute) => attribute.isValue);
  const valueAttributeId = valueAttribute?.attribute.id ?? null;
  const primaryPrimaryAttributes = primaryAttributes.filter(
    (attribute) => attribute.isPrimary && attribute.attribute.id !== valueAttributeId
  );
  const secondaryPrimaryAttributes = secondaryAttributes.filter(
    (attribute) => attribute.isPrimary
  );
  const primaryOtherAttributes = primaryAttributes.filter(
    (attribute) =>
      attribute.attribute.id !== valueAttributeId && !attribute.isPrimary
  );
  const secondaryOtherAttributes = secondaryAttributes.filter(
    (attribute) => !attribute.isPrimary
  );

  return {
    details: compactAttributeSections([
      {
        id: "value",
        title: copy?.value ?? "",
        attributes: valueAttribute ? [valueAttribute] : []
      },
      {
        id: "primary",
        title: copy?.attributes ?? "",
        attributes: [...primaryPrimaryAttributes, ...secondaryPrimaryAttributes]
      }
    ]),
    attributes: compactAttributeSections([
      {
        id: "primary-all",
        title: getCategoryAttributeSectionTitle({
          categoryId: selectedPrimaryCategoryId,
          partCategories
        }),
        attributes: [
          ...(valueAttribute ? [valueAttribute] : []),
          ...primaryPrimaryAttributes,
          ...primaryOtherAttributes
        ]
      },
      {
        id: "secondary-all",
        title: getCategoryAttributeSectionTitle({
          categoryId: selectedSecondaryCategoryId,
          partCategories
        }),
        attributes: [...secondaryPrimaryAttributes, ...secondaryOtherAttributes]
      }
    ])
  };
}

function compactAttributeSections(
  sections: Array<{
    id: string;
    title: string;
    attributes: EffectiveCategoryAttribute[];
  }>
) {
  return sections.filter((section) => section.attributes.length > 0);
}

function getCategoryAttributeSectionTitle({
  categoryId,
  partCategories
}: {
  categoryId: string;
  partCategories: PartCategoryListItem[];
}) {
  const category = partCategories.find((item) => item.id === categoryId);

  return category?.path ?? "";
}

function PartAttributeField({
  compact = false,
  disabled,
  effectiveAttribute,
  value,
  onValueChange
}: {
  compact?: boolean;
  disabled: boolean;
  effectiveAttribute: EffectiveCategoryAttribute;
  value: string;
  onValueChange: (attributeId: string, value: string) => void;
}) {
  const attribute = effectiveAttribute.attribute;
  const descriptionId = `${attribute.id}-description`;
  const commonClassName = compact
    ? "min-h-8 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
    : "min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <label
      className={
        compact
          ? "grid grid-cols-[minmax(10rem,16rem)_minmax(12rem,1fr)] items-center gap-3 px-3 py-2 text-sm font-medium text-slate-700"
          : "grid gap-1.5 p-3 text-sm font-medium text-slate-700"
      }
    >
      <span className="min-w-0">
        <span className="block truncate">{attribute.name}</span>
        {compact && attribute.description ? (
          <span
            id={descriptionId}
            className="mt-0.5 block truncate text-xs font-normal text-slate-500"
          >
            {attribute.description}
          </span>
        ) : null}
      </span>
      {attribute.type === "BOOLEAN" ? (
        <select
          aria-describedby={attribute.description ? descriptionId : undefined}
          className={commonClassName}
          disabled={disabled}
          value={value}
          onChange={(event) =>
            onValueChange(attribute.id, event.currentTarget.value)
          }
        >
          <option value="">-</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      ) : attribute.type === "CHOICE" ? (
        <select
          aria-describedby={attribute.description ? descriptionId : undefined}
          className={commonClassName}
          disabled={disabled}
          value={value}
          onChange={(event) =>
            onValueChange(attribute.id, event.currentTarget.value)
          }
        >
          <option value="">-</option>
          {attribute.choiceOptions.map((choiceOption) => (
            <option key={choiceOption.id} value={choiceOption.label}>
              {choiceOption.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          aria-describedby={attribute.description ? descriptionId : undefined}
          className={commonClassName}
          disabled={disabled}
          type={attribute.type === "NUMBER" ? "number" : "text"}
          value={value}
          onChange={(event) =>
            onValueChange(attribute.id, event.currentTarget.value)
          }
        />
      )}
      {!compact && attribute.description ? (
        <span
          id={descriptionId}
          className="text-xs font-normal text-slate-500"
        >
          {attribute.description}
        </span>
      ) : null}
    </label>
  );
}

function CategoryTreeSelect({
  allowOrganizationalCategories = false,
  buttonClassName = defaultCategorySelectButtonClassName,
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
  allowOrganizationalCategories?: boolean;
  buttonClassName?: string;
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
      excludedCategoryId,
      allowOrganizationalCategories
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

    if (
      isCategorySelectable({
        allowOrganizationalCategories,
        category: activeCategory,
        excludedCategoryId
      })
    ) {
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
        className={buttonClassName}
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
                        <CategoryTreeSelectNode
                          key={category.id}
                          category={category}
                          allowOrganizationalCategories={
                            allowOrganizationalCategories
                          }
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
  allowOrganizationalCategories,
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
  allowOrganizationalCategories: boolean;
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
  const isSelectable = isCategorySelectable({
    allowOrganizationalCategories,
    category,
    excludedCategoryId
  });
  const isSelected = selectedId === category.id;
  const isActive = activeCategoryId === category.id;
  const activeClassName = isSelectable
    ? "bg-[var(--color-accent-soft)] font-semibold text-slate-950 hover:bg-[var(--color-accent-soft)]"
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
              allowOrganizationalCategories={allowOrganizationalCategories}
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
  excludedCategoryId: string | undefined,
  allowOrganizationalCategories: boolean
): CategoryTreeItem | null {
  for (const category of categories) {
    if (
      isCategorySelectable({
        allowOrganizationalCategories,
        category,
        excludedCategoryId
      })
    ) {
      return category;
    }

    const matchingChild = findFirstAssignableCategory(
      category.children,
      excludedCategoryId,
      allowOrganizationalCategories
    );

    if (matchingChild) {
      return matchingChild;
    }
  }

  return null;
}

function isCategorySelectable({
  allowOrganizationalCategories,
  category,
  excludedCategoryId
}: {
  allowOrganizationalCategories: boolean;
  category: CategoryTreeItem;
  excludedCategoryId?: string;
}) {
  return (
    category.id !== excludedCategoryId &&
    (allowOrganizationalCategories || category.isAssignable)
  );
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

const primaryButtonClassName =
  "min-h-9 rounded-md border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:border-[var(--color-action-primary-hover)] hover:bg-[var(--color-action-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-focus)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400";
const defaultCategorySelectButtonClassName =
  "grid min-h-11 grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-base text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const compactCategorySelectButtonClassName =
  "grid min-h-9 grid-cols-[1fr_auto] items-center gap-3 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-left text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

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
        <span>{part.primaryCategoryPath}</span>
      ) : null}
      {part.secondaryCategoryPath && part.secondaryCategoryPath !== part.primaryCategoryPath ? (
        <span className="text-slate-500">{part.secondaryCategoryPath}</span>
      ) : null}
    </div>
  );
}
