"use client";

import type {
  CSSProperties,
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import { createPortal } from "react-dom";

import { createPart, updatePart } from "@/server/parts/createPart";
import type { ManufacturerSuggestion } from "@/server/organizations/organizations";
import type { PartCategoryListItem } from "@/server/parts/categories";
import type { PartsListItem } from "@/server/parts/getParts";
import type { EffectiveCategoryParameter } from "@/server/parts/parameters";
import {
  getNextToastId,
  ToastNotice,
  type ToastMessage
} from "@/app/toast-notice";

type Copy = {
  title: string;
  detailsTab: string;
  parametersTab: string;
  catalogNumber: string;
  value: string;
  parameterValues: string;
  primaryParameters: string;
  secondaryPrimaryParameters: string;
  primaryCategoryParameters: string;
  secondaryCategoryParameters: string;
  categories: string;
  primaryCategory: string;
  secondaryCategory: string;
  noCategory: string;
  noSecondaryCategory: string;
  manufacturer: string;
  noMatchingManufacturers: string;
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
  createdToast: string;
  updatedToast: string;
  missingRequiredFields: string;
  invalidCategory: string;
  secondaryWithoutPrimary: string;
  duplicateCategories: string;
  duplicatePart: string;
  invalidParameterValue: string;
  emptyTitle: string;
  emptyBody: string;
  databaseUnavailable: string;
};

type CategoryTreeItem = PartCategoryListItem & {
  children: CategoryTreeItem[];
};

type PartDialogTab = "details" | "parameters";

type PartsListClientProps = {
  copy: Copy;
  isDatabaseAvailable: boolean;
  partDialogOpen: boolean;
  partEditDialog?: string;
  partCategories: PartCategoryListItem[];
  categoryParametersByCategoryId: Record<string, EffectiveCategoryParameter[]>;
  manufacturerSuggestions: ManufacturerSuggestion[];
  parts: PartsListItem[];
  workspaceSlug: string;
};

export function PartsListClient({
  copy,
  isDatabaseAvailable,
  partDialogOpen,
  partEditDialog,
  partCategories,
  categoryParametersByCategoryId,
  manufacturerSuggestions,
  parts,
  workspaceSlug
}: PartsListClientProps) {
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const editDialogRef = useRef<HTMLDialogElement>(null);
  const nextToastIdRef = useRef(0);
  const categoryTree = buildCategoryTree(partCategories);
  const [currentParts, setCurrentParts] = useState(() => sortParts(parts));
  const [currentManufacturerSuggestions, setCurrentManufacturerSuggestions] =
    useState(manufacturerSuggestions);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const [createCatalogNumber, setCreateCatalogNumber] = useState("");
  const [createPrimaryCategoryId, setCreatePrimaryCategoryId] = useState("");
  const [createSecondaryCategoryId, setCreateSecondaryCategoryId] =
    useState("");
  const [createActiveTab, setCreateActiveTab] = useState<PartDialogTab>("details");
  const [createFormResetKey, setCreateFormResetKey] = useState(0);
  const [editCatalogNumber, setEditCatalogNumber] = useState("");
  const [editPrimaryCategoryId, setEditPrimaryCategoryId] = useState("");
  const [editSecondaryCategoryId, setEditSecondaryCategoryId] = useState("");
  const [editActiveTab, setEditActiveTab] = useState<PartDialogTab>("details");
  const [editingPart, setEditingPart] = useState<PartsListItem | null>(() =>
    currentParts.find((part) => part.id === partEditDialog) ?? null
  );
  const createHasParametersTab =
    getPartParameterGroups({
      categoryParametersByCategoryId,
      copy,
      selectedPrimaryCategoryId: createPrimaryCategoryId,
      selectedSecondaryCategoryId: createSecondaryCategoryId
    }).parameters.length > 0;
  const editHasParametersTab =
    getPartParameterGroups({
      categoryParametersByCategoryId,
      copy,
      selectedPrimaryCategoryId: editPrimaryCategoryId,
      selectedSecondaryCategoryId: editSecondaryCategoryId
    }).parameters.length > 0;
  const [createFormError, setCreateFormError] = useState<string | null>(null);
  const [updateFormError, setUpdateFormError] = useState<string | null>(null);
  const createPartMutation = useMutation({
    mutationFn: createPart,
    onError: () => {
      setCreateFormError("database-unavailable");
    },
    onSuccess: (result) => {
      if (!result.ok) {
        setCreateFormError(result.error);
        return;
      }

      setCurrentParts((currentItems) =>
        sortParts([...currentItems, result.part])
      );
      addManufacturerSuggestion(result.part.manufacturerName);
      setCreateCatalogNumber("");
      setCreatePrimaryCategoryId("");
      setCreateSecondaryCategoryId("");
      setCreateActiveTab("details");
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
    onSuccess: (result) => {
      if (!result.ok) {
        setUpdateFormError(result.error);
        return;
      }

      setCurrentParts((currentItems) =>
        sortParts(
          currentItems.map((part) =>
            part.id === result.part.id ? result.part : part
          )
        )
      );
      addManufacturerSuggestion(result.part.manufacturerName);
      setEditingPart(result.part);
      setEditActiveTab("details");
      addToastMessage({
        id: getNextToastId(nextToastIdRef),
        message: getPartSuccessMessage(copy.updatedToast, result.part)
      });
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
      columnHelper.accessor("catalogNumber", {
        header: copy.catalogNumber,
        cell: ({ getValue }) => (
          <span className="font-mono text-slate-950">{getValue()}</span>
        )
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
      columnHelper.accessor("manufacturerName", {
        header: copy.manufacturer,
        cell: ({ getValue }) => (
          <span className="text-slate-950">{getValue()}</span>
        )
      }),
      columnHelper.display({
        id: "actions",
        header: copy.actions,
        cell: ({ row }) => (
          <div className="text-right">
            <button
              className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
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
    if (!createHasParametersTab && createActiveTab === "parameters") {
      setCreateActiveTab("details");
    }
  }, [createActiveTab, createHasParametersTab]);

  useEffect(() => {
    if (!editHasParametersTab && editActiveTab === "parameters") {
      setEditActiveTab("details");
    }
  }, [editActiveTab, editHasParametersTab]);

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
      setEditPrimaryCategoryId(part.primaryCategoryId ?? "");
      setEditSecondaryCategoryId(part.secondaryCategoryId ?? "");
      setEditActiveTab("details");
      openDialog(editDialogRef.current);
    });
  }, [partEditDialog, currentParts]);

  function openEditDialog(part: PartsListItem) {
    setEditingPart(part);
    setEditCatalogNumber(part.catalogNumber);
    setEditPrimaryCategoryId(part.primaryCategoryId ?? "");
    setEditSecondaryCategoryId(part.secondaryCategoryId ?? "");
    setEditActiveTab("details");
    setUpdateFormError(null);
    window.requestAnimationFrame(() => openDialog(editDialogRef.current));
  }

  function openCreateDialog() {
    setCreateCatalogNumber("");
    setCreatePrimaryCategoryId("");
    setCreateSecondaryCategoryId("");
    setCreateActiveTab("details");
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
        <div className="flex items-center justify-end gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <button
            className="min-h-10 rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            disabled={!isDatabaseAvailable}
            type="button"
            onClick={openCreateDialog}
          >
            {copy.addPart}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              {partsTable.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      scope="col"
                      className={`border-b border-slate-200 px-4 py-3 font-semibold text-slate-600 ${
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
              {partsTable.getRowModel().rows.length > 0 ? (
                partsTable.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`border-b border-slate-100 px-4 py-3 text-slate-700 ${
                          cell.column.id === "actions" ? "py-2" : ""
                        }`}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-10" colSpan={5}>
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

      <ToastNotice messages={toastMessages} onDismiss={dismissToastMessage} />

      <dialog
        ref={createDialogRef}
        aria-labelledby="add-part-dialog-title"
        className="fixed inset-0 m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-2xl rounded-lg border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/40"
      >
        <div className="p-6">
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
                onClick={() => setCreateFormError(null)}
              >
                {copy.close}
              </button>
            </form>
          </div>

          {createFormError ? (
            <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {createFormError === "missing-required-fields"
                ? copy.missingRequiredFields
                : getPartFormErrorMessage(copy, createFormError)}
            </p>
          ) : null}

          <form className="grid gap-4" onSubmit={handleCreateSubmit}>
            <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
            <PartDialogTabs
              activeTab={createActiveTab}
              copy={copy}
              showParametersTab={createHasParametersTab}
              onTabChange={setCreateActiveTab}
            />
            <div className={createActiveTab === "details" ? "grid gap-4" : "hidden"}>
              <PartDetailsFields
                catalogNumber={createCatalogNumber}
                catalogNumberInputId="create-catalog-number"
                categoryTree={categoryTree}
                copy={copy}
                disabled={!isDatabaseAvailable}
                formResetKey={createFormResetKey}
                manufacturerInputId="create-manufacturer-name"
                manufacturerSuggestions={currentManufacturerSuggestions}
                partCategories={partCategories}
                primaryCategoryId={createPrimaryCategoryId}
                secondaryCategoryId={createSecondaryCategoryId}
                onCatalogNumberChange={setCreateCatalogNumber}
                onPrimaryCategoryChange={(categoryId) => {
                  setCreatePrimaryCategoryId(categoryId);
                  setCreateSecondaryCategoryId("");
                }}
                onSecondaryCategoryChange={setCreateSecondaryCategoryId}
              />
              <PartParameterSections
                categoryParametersByCategoryId={categoryParametersByCategoryId}
                copy={copy}
                disabled={!isDatabaseAvailable}
                part={null}
                selectedPrimaryCategoryId={createPrimaryCategoryId}
                selectedSecondaryCategoryId={createSecondaryCategoryId}
                tab="details"
              />
            </div>
            <div
              className={createActiveTab === "parameters" ? "grid gap-4" : "hidden"}
            >
              <PartParameterSections
                categoryParametersByCategoryId={categoryParametersByCategoryId}
                copy={copy}
                disabled={!isDatabaseAvailable}
                part={null}
                selectedPrimaryCategoryId={createPrimaryCategoryId}
                selectedSecondaryCategoryId={createSecondaryCategoryId}
                tab="parameters"
              />
            </div>
            <div className="flex justify-end">
              <button
                className="min-h-11 rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                type="submit"
                disabled={!isDatabaseAvailable || createPartMutation.isPending}
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
        <div className="p-6">
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
                onClick={() => setUpdateFormError(null)}
              >
                {copy.close}
              </button>
            </form>
          </div>

          {updateFormError ? (
            <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {updateFormError === "missing-required-fields"
                ? copy.missingRequiredFields
                : getPartFormErrorMessage(copy, updateFormError)}
            </p>
          ) : null}

          {editingPart ? (
            <form className="grid gap-4" onSubmit={handleUpdateSubmit}>
              <input name="workspaceSlug" type="hidden" value={workspaceSlug} />
              <input name="id" type="hidden" value={editingPart.id} />
              <PartDialogTabs
                activeTab={editActiveTab}
                copy={copy}
                showParametersTab={editHasParametersTab}
                onTabChange={setEditActiveTab}
              />
              <div className={editActiveTab === "details" ? "grid gap-4" : "hidden"}>
                <PartDetailsFields
                  catalogNumber={editCatalogNumber}
                  catalogNumberInputId="edit-catalog-number"
                  categoryTree={categoryTree}
                  copy={copy}
                  defaultManufacturerName={editingPart.manufacturerName}
                  disabled={!isDatabaseAvailable}
                  formResetKey={`${editingPart.id}-${editingPart.manufacturerName}`}
                  manufacturerInputId="edit-manufacturer-name"
                  manufacturerSuggestions={currentManufacturerSuggestions}
                  partCategories={partCategories}
                  primaryCategoryId={editPrimaryCategoryId}
                  secondaryCategoryId={editSecondaryCategoryId}
                  onCatalogNumberChange={setEditCatalogNumber}
                  onPrimaryCategoryChange={(categoryId) => {
                    setEditPrimaryCategoryId(categoryId);

                    if (!categoryId || editSecondaryCategoryId === categoryId) {
                      setEditSecondaryCategoryId("");
                    }
                  }}
                  onSecondaryCategoryChange={setEditSecondaryCategoryId}
                />
                <PartParameterSections
                  categoryParametersByCategoryId={categoryParametersByCategoryId}
                  copy={copy}
                  disabled={!isDatabaseAvailable}
                  part={editingPart}
                  selectedPrimaryCategoryId={editPrimaryCategoryId}
                  selectedSecondaryCategoryId={editSecondaryCategoryId}
                  tab="details"
                />
              </div>
              <div
                className={editActiveTab === "parameters" ? "grid gap-4" : "hidden"}
              >
                <PartParameterSections
                  categoryParametersByCategoryId={categoryParametersByCategoryId}
                  copy={copy}
                  disabled={!isDatabaseAvailable}
                  part={editingPart}
                  selectedPrimaryCategoryId={editPrimaryCategoryId}
                  selectedSecondaryCategoryId={editSecondaryCategoryId}
                  tab="parameters"
                />
              </div>
              <div className="flex justify-end">
                <button
                  className="min-h-11 rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                  type="submit"
                  disabled={!isDatabaseAvailable || updatePartMutation.isPending}
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

function closeDialog(dialog: HTMLDialogElement | null) {
  if (!dialog?.open) {
    return;
  }

  dialog.close();
}

function getPartSuccessMessage(actionLabel: string, part: PartsListItem) {
  return `${actionLabel}: ${part.manufacturerName} ${part.catalogNumber}.`;
}

function sortParts(parts: PartsListItem[]) {
  return [...parts].sort((left, right) => {
    const manufacturerOrder = left.manufacturerName.localeCompare(
      right.manufacturerName,
      "en",
      { sensitivity: "base" }
    );

    if (manufacturerOrder !== 0) {
      return manufacturerOrder;
    }

    return left.catalogNumber.localeCompare(right.catalogNumber, "en", {
      sensitivity: "base"
    });
  });
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

  if (error === "invalid-parameter-value") {
    return copy.invalidParameterValue;
  }

  return copy.databaseUnavailable;
}

function ManufacturerAutocomplete({
  copy,
  defaultValue = "",
  disabled,
  inputId,
  name,
  placeholder,
  suggestions
}: {
  copy: Copy;
  defaultValue?: string;
  disabled: boolean;
  inputId: string;
  name: string;
  placeholder: string;
  suggestions: ManufacturerSuggestion[];
}) {
  const listboxId = `${inputId}-suggestions`;
  const [value, setValue] = useState(defaultValue);
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
    setValue(suggestion.name);
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
    <div className="relative grid gap-2 text-sm font-medium text-slate-700">
      <label htmlFor={inputId}>{copy.manufacturer}</label>
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
        className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
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

          setValue(nextValue);
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
                        ? "bg-cyan-100 font-semibold text-slate-950"
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
  showParametersTab,
  onTabChange
}: {
  activeTab: PartDialogTab;
  copy: Copy;
  showParametersTab: boolean;
  onTabChange: (tab: PartDialogTab) => void;
}) {
  return (
    <div className="flex gap-2 border-b border-slate-200">
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
      {showParametersTab ? (
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
      ) : null}
    </div>
  );
}

function PartDetailsFields({
  catalogNumber,
  catalogNumberInputId,
  categoryTree,
  copy,
  defaultManufacturerName,
  disabled,
  formResetKey,
  manufacturerInputId,
  manufacturerSuggestions,
  partCategories,
  primaryCategoryId,
  secondaryCategoryId,
  onCatalogNumberChange,
  onPrimaryCategoryChange,
  onSecondaryCategoryChange
}: {
  catalogNumber: string;
  catalogNumberInputId: string;
  categoryTree: CategoryTreeItem[];
  copy: Copy;
  defaultManufacturerName?: string;
  disabled: boolean;
  formResetKey: number | string;
  manufacturerInputId: string;
  manufacturerSuggestions: ManufacturerSuggestion[];
  partCategories: PartCategoryListItem[];
  primaryCategoryId: string;
  secondaryCategoryId: string;
  onCatalogNumberChange: (catalogNumber: string) => void;
  onPrimaryCategoryChange: (categoryId: string) => void;
  onSecondaryCategoryChange: (categoryId: string) => void;
}) {
  return (
    <>
      <label
        className="grid gap-2 text-sm font-medium text-slate-700"
        htmlFor={catalogNumberInputId}
      >
        {copy.catalogNumber}
        <input
          className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
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
        defaultValue={defaultManufacturerName}
        disabled={disabled}
        inputId={manufacturerInputId}
        name="manufacturerName"
        placeholder={copy.manufacturerPlaceholder}
        suggestions={manufacturerSuggestions}
      />
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
    </>
  );
}

function PartParameterSections({
  categoryParametersByCategoryId,
  copy,
  disabled,
  part,
  selectedPrimaryCategoryId,
  selectedSecondaryCategoryId,
  tab
}: {
  categoryParametersByCategoryId: Record<string, EffectiveCategoryParameter[]>;
  copy: Copy;
  disabled: boolean;
  part: PartsListItem | null;
  selectedPrimaryCategoryId: string;
  selectedSecondaryCategoryId: string;
  tab: PartDialogTab;
}) {
  const groups = getPartParameterGroups({
    categoryParametersByCategoryId,
    copy,
    selectedPrimaryCategoryId,
    selectedSecondaryCategoryId
  });
  const sections = tab === "details" ? groups.details : groups.parameters;
  const existingValuesByParameterId = new Map(
    (part?.parameterValues ?? []).map((parameterValue) => [
      parameterValue.parameterId,
      parameterValue.displayValue
    ])
  );

  if (sections.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-4">
      {sections.map((section) => (
        <fieldset
          key={section.id}
          className="grid gap-3 rounded-md border border-slate-200 p-4"
        >
          <legend className="px-1 text-sm font-semibold text-slate-700">
            {section.title}
          </legend>
          {section.parameters.map((effectiveParameter) => (
            <PartParameterField
              key={effectiveParameter.parameter.id}
              disabled={disabled}
              effectiveParameter={effectiveParameter}
              value={
                existingValuesByParameterId.get(effectiveParameter.parameter.id) ??
                effectiveParameter.defaultValue?.displayValue ??
                ""
              }
            />
          ))}
        </fieldset>
      ))}
    </div>
  );
}

function getPartParameterGroups({
  categoryParametersByCategoryId,
  copy,
  selectedPrimaryCategoryId,
  selectedSecondaryCategoryId
}: {
  categoryParametersByCategoryId: Record<string, EffectiveCategoryParameter[]>;
  copy: Copy;
  selectedPrimaryCategoryId: string;
  selectedSecondaryCategoryId: string;
}) {
  const primaryParameters = selectedPrimaryCategoryId
    ? categoryParametersByCategoryId[selectedPrimaryCategoryId] ?? []
    : [];
  const primaryParameterIds = new Set(
    primaryParameters.map((parameter) => parameter.parameter.id)
  );
  const secondaryParameters = selectedSecondaryCategoryId
    ? (categoryParametersByCategoryId[selectedSecondaryCategoryId] ?? []).filter(
        (parameter) => !primaryParameterIds.has(parameter.parameter.id)
      )
    : [];
  const valueParameter = primaryParameters.find((parameter) => parameter.isValue);
  const valueParameterId = valueParameter?.parameter.id ?? null;
  const primaryPrimaryParameters = primaryParameters.filter(
    (parameter) => parameter.isPrimary && parameter.parameter.id !== valueParameterId
  );
  const secondaryPrimaryParameters = secondaryParameters.filter(
    (parameter) => parameter.isPrimary
  );
  const primaryOtherParameters = primaryParameters.filter(
    (parameter) =>
      parameter.parameter.id !== valueParameterId && !parameter.isPrimary
  );
  const secondaryOtherParameters = secondaryParameters.filter(
    (parameter) => !parameter.isPrimary
  );

  return {
    details: compactParameterSections([
      {
        id: "value",
        title: copy.value,
        parameters: valueParameter ? [valueParameter] : []
      },
      {
        id: "primary-primary",
        title: copy.primaryParameters,
        parameters: primaryPrimaryParameters
      },
      {
        id: "secondary-primary",
        title: copy.secondaryPrimaryParameters,
        parameters: secondaryPrimaryParameters
      }
    ]),
    parameters: compactParameterSections([
      {
        id: "primary-other",
        title: copy.primaryCategoryParameters,
        parameters: primaryOtherParameters
      },
      {
        id: "secondary-other",
        title: copy.secondaryCategoryParameters,
        parameters: secondaryOtherParameters
      }
    ])
  };
}

function compactParameterSections(
  sections: Array<{
    id: string;
    title: string;
    parameters: EffectiveCategoryParameter[];
  }>
) {
  return sections.filter((section) => section.parameters.length > 0);
}

function PartParameterField({
  disabled,
  effectiveParameter,
  value
}: {
  disabled: boolean;
  effectiveParameter: EffectiveCategoryParameter;
  value: string;
}) {
  const parameter = effectiveParameter.parameter;
  const inputName = `parameterValue:${parameter.id}`;
  const descriptionId = `${parameter.id}-description`;
  const commonClassName =
    "min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <label className="grid gap-2 text-sm font-medium text-slate-700">
      {parameter.name}
      {parameter.type === "BOOLEAN" ? (
        <select
          aria-describedby={parameter.description ? descriptionId : undefined}
          className={commonClassName}
          defaultValue={value}
          disabled={disabled}
          name={inputName}
        >
          <option value="">-</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      ) : parameter.type === "CHOICE" ? (
        <select
          aria-describedby={parameter.description ? descriptionId : undefined}
          className={commonClassName}
          defaultValue={value}
          disabled={disabled}
          name={inputName}
        >
          <option value="">-</option>
          {parameter.choiceOptions.map((choiceOption) => (
            <option key={choiceOption.id} value={choiceOption.label}>
              {choiceOption.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          aria-describedby={parameter.description ? descriptionId : undefined}
          className={commonClassName}
          defaultValue={value}
          disabled={disabled}
          name={inputName}
          type={parameter.type === "NUMBER" ? "number" : "text"}
        />
      )}
      {parameter.description ? (
        <span id={descriptionId} className="text-xs font-normal text-slate-500">
          {parameter.description}
        </span>
      ) : null}
    </label>
  );
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
