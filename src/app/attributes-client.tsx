"use client";

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable
} from "@tanstack/react-table";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQueryClient
} from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";

import {
  createAttributeForWorkspace,
  deleteAttributeForWorkspace,
  getAttributeDictionaryPageForWorkspace,
  updateAttributeForWorkspace
} from "@/server/parts/attributeActions";
import type { AttributeListItem } from "@/server/parts/attributeMutations";
import type { AttributeValueType } from "@/server/parts/attributeValues";
import { InfiniteListViewport } from "@/app/infinite-list";
import {
  useListTableConfiguration,
  type ListColumnDefinition
} from "@/app/list-table-config";
import {
  ListPageToolbar,
  ListTableHeaderCell,
  useColumnDragReorder,
  useColumnResizeCursor
} from "@/app/list-page-toolbar";
import { EmptyCell } from "@/app/list-table-cell";
import {
  getNextToastId,
  ToastNotice,
  type ToastMessage
} from "@/app/toast-notice";
import {
  DeleteConfirmationDialog,
  DialogActions,
  DialogBody,
  DialogShell,
  ErrorBubble,
  LabelWithError,
  closeDialog,
  getFieldInputClassName,
  openDialog
} from "@/app/dialog-shell";

type Copy = {
  title: string;
  addAttribute: string;
  actions: string;
  edit: string;
  delete: string;
  close: string;
  cancelDelete: string;
  confirmDelete: string;
  deleteConfirmationBody: string;
  createAttribute: string;
  saveChanges: string;
  addOption: string;
  deleteOption: string;
  newAttributeTitle: string;
  editAttributeTitle: string;
  name: string;
  description: string;
  type: string;
  baseUnit: string;
  options: string;
  noOptions: string;
  noAttributes: string;
  loadingAttributes: string;
  loadingMoreAttributes: string;
  text: string;
  number: string;
  quantity: string;
  boolean: string;
  choice: string;
  optionLabel: string;
  sortOrder: string;
  createdToast: string;
  updatedToast: string;
  deletedToast: string;
  databaseUnavailable: string;
  invalidInput: string;
  configureList: string;
  visibleColumns: string;
  listCountSummary: string;
};

const columnHelper = createColumnHelper<AttributeListItem>();

type ListPage<TItem> = {
  items: TItem[];
  nextCursor: string | null;
  totalCount: number;
  filteredCount: number;
};

type AttributesClientProps = {
  canWriteAttributes: boolean;
  copy: Copy;
  isDatabaseAvailable: boolean;
  initialPage: ListPage<AttributeListItem>;
  workspaceSlug: string;
};

type ChoiceOptionDraft = {
  draftId: number;
  id?: string;
  label: string;
  sortOrder: number;
};

type AttributeDialogMode = "create" | "edit";
type AttributeFormField = "name" | "baseUnitSymbol" | "submit" | "delete";
type AttributeFormErrors = Partial<Record<AttributeFormField, string>>;

export function AttributesClient({
  canWriteAttributes,
  copy,
  isDatabaseAvailable,
  initialPage,
  workspaceSlug
}: AttributesClientProps) {
  const queryClient = useQueryClient();
  const attributeDialogRef = useRef<HTMLDialogElement>(null);
  const nextToastIdRef = useRef(0);
  const [attributeDialogMode, setAttributeDialogMode] =
    useState<AttributeDialogMode | null>(null);
  const [editingAttribute, setEditingAttribute] =
    useState<AttributeListItem | null>(null);
  const [attributePendingDelete, setAttributePendingDelete] =
    useState<AttributeListItem | null>(null);
  const [attributeFieldErrors, setAttributeFieldErrors] =
    useState<AttributeFormErrors>({});
  const [dialogFormKey, setDialogFormKey] = useState(0);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const { isResizingColumn, setIsResizingColumn, containerClassName } =
    useColumnResizeCursor();

  // --- Column configuration ---

  const attributeColumns = useMemo<ListColumnDefinition[]>(
    () => [
      { id: "name", label: copy.name, group: "base", defaultWidth: 220, minWidth: 120, sortable: true },
      { id: "type", label: copy.type, group: "base", defaultWidth: 140, minWidth: 100, sortable: true },
      { id: "baseUnit", label: copy.baseUnit, group: "base", defaultWidth: 120, minWidth: 80, sortable: true },
      { id: "options", label: copy.options, group: "base", defaultWidth: 240, minWidth: 120 },
      { id: "description", label: copy.description, group: "base", defaultWidth: 280, minWidth: 120, sortable: true }
    ],
    [copy]
  );
  const fixedColumnIds = useMemo(() => ["actions"], []);

  const {
    columnSizing,
    columnVisibility,
    configurableColumns,
    setColumnWidth,
    setColumnSorting,
    setColumnVisible,
    setColumnOrder,
    setColumnSizing,
    setColumnVisibility,
    setSorting,
    sorting,
    columnOrder: persistedColumnOrder,
    isLoaded: isConfigLoaded
  } = useListTableConfiguration({
    storageKey: `oso:list-config:attributes:${workspaceSlug}`,
    columns: attributeColumns,
    fixedColumnIds
  });

  const { draggedColumnId, onDragEnd, onStartDrag, onDropOnto } =
    useColumnDragReorder(setColumnOrder);

  // --- Data ---

  const activeSorting = sorting[0] ?? null;
  const sortDir = activeSorting?.desc ? "desc" : "asc";
  const sortBy = (activeSorting?.id ??
    "name") as "name" | "type" | "baseUnit" | "description";

  const attributesQuery = useInfiniteQuery({
    queryKey: ["attributes-list", workspaceSlug, { sorting }] as const,
    enabled: isDatabaseAvailable,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const result = await getAttributeDictionaryPageForWorkspace({
        workspaceSlug,
        cursor: pageParam,
        sortBy,
        sortDir
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
    initialData:
      sorting.length === 0
        ? { pages: [initialPage], pageParams: [null] }
        : undefined
  });
  const currentAttributes = useMemo(
    () => attributesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [attributesQuery.data]
  );
  const currentAttributesById = useMemo(
    () => new Map(currentAttributes.map((attribute) => [attribute.id, attribute])),
    [currentAttributes]
  );
  async function refreshAttributes() {
    await queryClient.invalidateQueries({
      queryKey: ["attributes-list", workspaceSlug]
    });
  }
  const createAttributeMutation = useMutation({
    mutationFn: createAttributeForWorkspace,
    onSuccess: async (result) => {
      if (!result.ok) {
        setAttributeFieldErrors(getAttributeFormErrors(copy, result.error));
        setAttributePendingDelete(null);
        return;
      }

      await refreshAttributes();
      setAttributePendingDelete(null);
      setAttributeFieldErrors({});
      addToast(getAttributeSuccessMessage(copy.createdToast, result.data.name));
      closeAttributeDialog();
    },
    onError: () =>
      setAttributeFieldErrors({
        submit: getErrorMessage(copy, "database-unavailable")
      })
  });
  const updateAttributeMutation = useMutation({
    mutationFn: updateAttributeForWorkspace,
    onSuccess: async (result) => {
      if (!result.ok) {
        setAttributeFieldErrors(getAttributeFormErrors(copy, result.error));
        return;
      }

      await refreshAttributes();
      setAttributeFieldErrors({});
      addToast(getAttributeSuccessMessage(copy.updatedToast, result.data.name));
      closeAttributeDialog();
    },
    onError: () =>
      setAttributeFieldErrors({
        submit: getErrorMessage(copy, "database-unavailable")
      })
  });
  const deleteAttributeMutation = useMutation({
    mutationFn: deleteAttributeForWorkspace,
    onSuccess: async (result, variables) => {
      if (!result.ok) {
        setAttributeFieldErrors({
          delete: getErrorMessage(copy, result.error)
        });
        return;
      }

      const deletedAttributeName =
        currentAttributesById.get(variables.attributeId)?.name ??
        editingAttribute?.name ??
        "";

      await refreshAttributes();
      setAttributeFieldErrors({});
      addToast(getAttributeSuccessMessage(copy.deletedToast, deletedAttributeName));
      closeAttributeDialog();
    },
    onError: () =>
      setAttributeFieldErrors({
        delete: getErrorMessage(copy, "database-unavailable")
      })
  });
  function openCreateDialog() {
    setEditingAttribute(null);
    setAttributeDialogMode("create");
    setAttributeFieldErrors({});
    setDialogFormKey((currentKey) => currentKey + 1);
    window.requestAnimationFrame(() => openDialog(attributeDialogRef.current));
  }

  function openEditDialog(attribute: AttributeListItem) {
    setEditingAttribute(attribute);
    setAttributeDialogMode("edit");
    setAttributeFieldErrors({});
    setDialogFormKey((currentKey) => currentKey + 1);
    window.requestAnimationFrame(() => openDialog(attributeDialogRef.current));
  }

  function handleCreateSubmit(formData: FormData) {
    const fieldErrors = validateAttributeForm(copy, formData);

    setAttributeFieldErrors(fieldErrors);

    if (hasFieldErrors(fieldErrors)) {
      return;
    }

    createAttributeMutation.mutate({
      workspaceSlug,
      name: getFormString(formData, "name"),
      description: getFormString(formData, "description"),
      type: getFormString(formData, "type") as AttributeValueType,
      baseUnitSymbol: getFormString(formData, "baseUnitSymbol"),
      choiceOptions: getChoiceOptionsFromFormData(formData)
    });
  }

  function handleUpdateSubmit(formData: FormData) {
    if (!editingAttribute) {
      return;
    }

    const fieldErrors = validateAttributeForm(copy, formData);

    setAttributeFieldErrors(fieldErrors);

    if (hasFieldErrors(fieldErrors)) {
      return;
    }

    updateAttributeMutation.mutate({
      workspaceSlug,
      attributeId: editingAttribute.id,
      name: getFormString(formData, "name"),
      description: getFormString(formData, "description"),
      type: getFormString(formData, "type") as AttributeValueType,
      baseUnitSymbol: getFormString(formData, "baseUnitSymbol"),
      choiceOptions: getChoiceOptionUpdatesFromFormData(formData)
    });
  }

  function handleDeleteAttribute(attribute: AttributeListItem) {
    setAttributeFieldErrors({});
    setAttributePendingDelete(attribute);
  }

  function confirmDeleteAttribute() {
    if (!attributePendingDelete) {
      return;
    }

    setAttributeFieldErrors({});
    deleteAttributeMutation.mutate({
      workspaceSlug,
      attributeId: attributePendingDelete.id
    });
  }

  function closeAttributeDialog() {
    closeDialog(attributeDialogRef.current);
    setAttributeDialogMode(null);
    setEditingAttribute(null);
    setAttributeFieldErrors({});
  }

  function addToast(message: string) {
    setToastMessages((currentMessages) => [
      ...currentMessages,
      {
        id: getNextToastId(nextToastIdRef),
        message
      }
    ]);
  }

  function dismissToastMessage(toastId: number) {
    setToastMessages((currentMessages) =>
      currentMessages.filter((toast) => toast.id !== toastId)
    );
  }

  // --- TanStack Table ---

  const columns = useMemo(
    () => [
      columnHelper.accessor("name", {
        header: copy.name,
        size: 220,
        minSize: 120,
        cell: ({ getValue }) => (
          <span className="font-medium text-[var(--color-text-primary)]">{getValue()}</span>
        )
      }),
      columnHelper.accessor("type", {
        header: copy.type,
        size: 140,
        minSize: 100,
        cell: ({ getValue }) => (
          <span className="text-[var(--color-text-secondary)]">
            {getTypeLabel(copy, getValue())}
          </span>
        )
      }),
      columnHelper.accessor("baseUnitSymbol", {
        id: "baseUnit",
        header: copy.baseUnit,
        size: 120,
        minSize: 80,
        cell: ({ getValue }) => {
          const value = getValue();
          if (!value) return <EmptyCell />;
          return <span className="text-[var(--color-text-secondary)]">{value}</span>;
        }
      }),
      columnHelper.accessor("choiceOptions", {
        id: "options",
        header: copy.options,
        size: 240,
        minSize: 120,
        enableSorting: false,
        cell: ({ getValue }) => {
          const options = getValue();
          if (options.length === 0) return <EmptyCell />;
          return (
            <span className="line-clamp-2 text-[var(--color-text-secondary)]">
              {options.map((option) => option.label).join(", ")}
            </span>
          );
        }
      }),
      columnHelper.accessor("description", {
        header: copy.description,
        size: 280,
        minSize: 120,
        cell: ({ getValue }) => {
          const value = getValue();
          if (!value) return <EmptyCell />;
          return <span className="line-clamp-2 text-[var(--color-text-muted)]">{value}</span>;
        }
      }),
      columnHelper.display({
        id: "actions",
        header: "",
        size: 104,
        minSize: 104,
        maxSize: 104,
        enableResizing: false,
        cell: ({ row }) => (
          <div className="flex justify-end gap-2">
            <button
              className="min-h-8 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
              aria-label={copy.edit}
              disabled={!isDatabaseAvailable || !canWriteAttributes}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openEditDialog(row.original);
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
            <button
              className="min-h-8 rounded-md border border-[var(--color-error-border)] bg-[var(--color-bg-elevated)] px-2.5 py-1 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
              aria-label={copy.delete}
              disabled={
                !isDatabaseAvailable ||
                !canWriteAttributes ||
                deleteAttributeMutation.isPending
              }
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleDeleteAttribute(row.original);
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
          </div>
        )
      })
    ],
    [canWriteAttributes, copy, isDatabaseAvailable, deleteAttributeMutation.isPending]
  );

  const tableColumnOrder = useMemo(() => persistedColumnOrder, [persistedColumnOrder]);

  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    data: currentAttributes,
    columns,
    state: {
      columnVisibility,
      columnOrder: tableColumnOrder,
      sorting,
      columnSizing
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    columnResizeMode: "onChange",
    enableColumnResizing: true,
    manualSorting: true,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <>
      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${containerClassName}`}>
        <section
          aria-labelledby="attributes-heading"
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-sm"
        >
          <h2 id="attributes-heading" className="sr-only">
            {copy.title}
          </h2>
          <ListPageToolbar
            columnVisibility={columnVisibility}
            configurableColumns={configurableColumns}
            configureListLabel={copy.configureList}
            filteredCount={attributesQuery.data?.pages[0]?.filteredCount}
            formatCount={(visible, total) =>
              copy.listCountSummary
                .replace("{visible}", String(visible))
                .replace("{total}", String(total))
            }
            totalCount={attributesQuery.data?.pages[0]?.totalCount}
            visibleColumnsLabel={copy.visibleColumns}
            setColumnVisible={setColumnVisible}
            primaryAction={
              <button
                className={primaryButtonClassName}
                disabled={!isDatabaseAvailable || !canWriteAttributes}
                type="button"
                onClick={openCreateDialog}
              >
                {copy.addAttribute}
              </button>
            }
          />
          <InfiniteListViewport
            emptyState={<p className="px-4 py-10 text-sm text-[var(--color-text-muted)]">{copy.noAttributes}</p>}
            errorState={
              <p className="px-4 py-10 text-sm text-[var(--color-text-muted)]">
                {copy.databaseUnavailable}
              </p>
            }
            hasNextPage={Boolean(attributesQuery.hasNextPage)}
            isEmpty={currentAttributes.length === 0}
            isError={attributesQuery.isError}
            isFetchingNextPage={attributesQuery.isFetchingNextPage}
            isInitialLoading={!isConfigLoaded || attributesQuery.isLoading}
            loadingLabel={copy.loadingAttributes}
            loadingMoreLabel={copy.loadingMoreAttributes}
            loadMore={() => {
              void attributesQuery.fetchNextPage();
            }}
            testId="attributes-list-viewport"
          >
            <table
              className="table-fixed border-separate border-spacing-0 text-left text-sm"
              style={{ width: table.getTotalSize() }}
            >
              <colgroup>
                {table.getVisibleLeafColumns().map((col) => (
                  <col key={col.id} style={{ width: col.getSize() }} />
                ))}
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[var(--color-bg-subtle)]">
                {table.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <ListTableHeaderCell
                        key={header.id}
                        columnDefs={attributeColumns}
                        draggedColumnId={draggedColumnId}
                        header={header}
                        isResizingColumn={isResizingColumn}
                        setColumnSorting={setColumnSorting}
                        setColumnWidth={setColumnWidth}
                        setIsResizingColumn={setIsResizingColumn}
                        onDragEnd={onDragEnd}
                        onDropOnto={onDropOnto}
                        onStartDrag={onStartDrag}
                      />
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-[var(--color-bg-elevated)]">
                {table.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-[var(--color-bg-subtle)]">
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`overflow-hidden border-b border-[var(--color-border)] px-2 py-2 text-[var(--color-text-secondary)] ${
                          cell.column.id === "actions"
                            ? "sticky right-0 z-10 bg-[var(--color-bg-elevated)] px-1 py-1.5 hover:bg-[var(--color-bg-subtle)]"
                            : ""
                        }`}
                        style={{ width: cell.column.getSize() }}
                      >
                        <div className="overflow-hidden text-ellipsis">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </InfiniteListViewport>
        </section>
      </div>
      {attributeFieldErrors.delete ? (
        <div className="mt-3">
          <ErrorBubble align="start">{attributeFieldErrors.delete}</ErrorBubble>
        </div>
      ) : null}

      <ToastNotice messages={toastMessages} onDismiss={dismissToastMessage} />

      <DialogShell
        ref={attributeDialogRef}
        closeLabel={copy.close}
        title={
          attributeDialogMode === "create"
            ? copy.newAttributeTitle
            : copy.editAttributeTitle
        }
        titleId="attribute-dialog-title"
        onClose={() => {
          setAttributeDialogMode(null);
          setEditingAttribute(null);
        }}
      >
        {attributeDialogMode ? (
          <AttributeDialogContent
            key={`${attributeDialogMode}-${editingAttribute?.id ?? "new"}-${dialogFormKey}`}
            copy={copy}
            errors={attributeFieldErrors}
            isDatabaseAvailable={isDatabaseAvailable}
            isPending={
              attributeDialogMode === "create"
                ? createAttributeMutation.isPending
                : updateAttributeMutation.isPending
            }
            mode={attributeDialogMode}
            attribute={editingAttribute}
            onSubmit={
              attributeDialogMode === "create"
                ? handleCreateSubmit
                : handleUpdateSubmit
            }
          />
        ) : null}
      </DialogShell>
      <DeleteConfirmationDialog
        body={copy.deleteConfirmationBody}
        cancelLabel={copy.cancelDelete}
        closeLabel={copy.close}
        confirmLabel={copy.confirmDelete}
        deleteLabel={copy.delete}
        isPending={deleteAttributeMutation.isPending}
        itemName={attributePendingDelete?.name ?? ""}
        open={Boolean(attributePendingDelete)}
        onCancel={() => setAttributePendingDelete(null)}
        onConfirm={confirmDeleteAttribute}
      />
    </>
  );
}

function AttributeDialogContent({
  copy,
  errors,
  isDatabaseAvailable,
  isPending,
  mode,
  attribute,
  onSubmit
}: {
  copy: Copy;
  errors: AttributeFormErrors;
  isDatabaseAvailable: boolean;
  isPending: boolean;
  mode: AttributeDialogMode;
  attribute: AttributeListItem | null;
  onSubmit: (formData: FormData) => void;
}) {
  const formId = "attribute-dialog-form";
  const [type, setType] = useState<AttributeValueType>(
    attribute?.type ?? "QUANTITY"
  );
  const [choiceOptionDrafts, setChoiceOptionDrafts] = useState<
    ChoiceOptionDraft[]
  >(
    mode === "edit" && attribute
      ? getChoiceOptionDrafts(attribute.choiceOptions)
      : [{ draftId: 0, label: "", sortOrder: 0 }]
  );
  const submitLabel =
    mode === "create" ? copy.createAttribute : copy.saveChanges;
  const shouldShowOptions = type === "CHOICE";

  function updateChoiceOptionDraft(
    draftId: number,
    patch: Partial<Pick<ChoiceOptionDraft, "label" | "sortOrder">>
  ) {
    setChoiceOptionDrafts((currentDrafts) =>
      currentDrafts.map((draft) =>
        draft.draftId === draftId ? { ...draft, ...patch } : draft
      )
    );
  }

  function addChoiceOptionDraft() {
    setChoiceOptionDrafts((currentDrafts) => [
      ...currentDrafts,
      {
        draftId: getNextDraftId(currentDrafts),
        label: "",
        sortOrder: 0
      }
    ]);
  }

  function removeChoiceOptionDraft(draftId: number) {
    setChoiceOptionDrafts((currentDrafts) =>
      currentDrafts.filter((draft) => draft.draftId !== draftId)
    );
  }

  return (
    <>
      <form
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(new FormData(event.currentTarget));
        }}
      >
        <DialogBody className="flex-1">
          <div className="grid gap-3">
            <label className={labelClassName}>
              <LabelWithError error={errors.name}>{copy.name}</LabelWithError>
              <input
                aria-invalid={errors.name ? true : undefined}
                className={getFieldInputClassName(
                  inputClassName,
                  Boolean(errors.name)
                )}
                defaultValue={attribute?.name ?? ""}
                disabled={!isDatabaseAvailable}
                name="name"
                required
              />
            </label>
            <label className={labelClassName}>
              {copy.description}
              <textarea
                className={`${inputClassName} min-h-20`}
                defaultValue={attribute?.description ?? ""}
                disabled={!isDatabaseAvailable}
                name="description"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
          <label className={labelClassName}>
            {copy.type}
            <select
              className={inputClassName}
              defaultValue={attribute?.type ?? "QUANTITY"}
              disabled={!isDatabaseAvailable}
              name="type"
              onChange={(event) =>
                setType(event.currentTarget.value as AttributeValueType)
              }
            >
              <option value="TEXT">{copy.text}</option>
              <option value="NUMBER">{copy.number}</option>
              <option value="QUANTITY">{copy.quantity}</option>
              <option value="BOOLEAN">{copy.boolean}</option>
              <option value="CHOICE">{copy.choice}</option>
            </select>
          </label>
          <label className={labelClassName}>
            <LabelWithError error={errors.baseUnitSymbol}>
              {copy.baseUnit}
            </LabelWithError>
            <input
              aria-invalid={errors.baseUnitSymbol ? true : undefined}
              className={getFieldInputClassName(
                inputClassName,
                Boolean(errors.baseUnitSymbol)
              )}
              defaultValue={attribute?.baseUnitSymbol ?? ""}
              disabled={!isDatabaseAvailable || type !== "QUANTITY"}
              name="baseUnitSymbol"
              placeholder="Ω"
              required={type === "QUANTITY"}
            />
          </label>
            </div>
            {shouldShowOptions ? (
              <ChoiceOptionsEditor
                copy={copy}
                formId={formId}
                includeOptionIds={mode === "edit"}
                options={choiceOptionDrafts}
                onAdd={addChoiceOptionDraft}
                onRemove={removeChoiceOptionDraft}
                onUpdate={updateChoiceOptionDraft}
              />
            ) : null}
          </div>
        </DialogBody>
        <DialogActions
          cancelLabel={copy.cancelDelete}
          actionLabel={submitLabel}
          disabled={!isDatabaseAvailable || isPending}
          error={errors.submit}
        />
      </form>
    </>
  );
}

function getTypeLabel(copy: Copy, type: AttributeValueType) {
  const labels: Record<AttributeValueType, string> = {
    TEXT: copy.text,
    NUMBER: copy.number,
    QUANTITY: copy.quantity,
    BOOLEAN: copy.boolean,
    CHOICE: copy.choice
  };

  return labels[type];
}

function ChoiceOptionsEditor({
  copy,
  formId,
  includeOptionIds = false,
  options,
  onAdd,
  onRemove,
  onUpdate
}: {
  copy: Copy;
  formId?: string;
  includeOptionIds?: boolean;
  options: ChoiceOptionDraft[];
  onAdd: () => void;
  onRemove: (draftId: number) => void;
  onUpdate: (
    draftId: number,
    patch: Partial<Pick<ChoiceOptionDraft, "label" | "sortOrder">>
  ) => void;
}) {
  return (
    <div className="mt-4 border-t border-[var(--color-border)] pt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{copy.options}</h3>
        <button
          className={compactSecondaryButtonClassName}
          type="button"
          onClick={onAdd}
        >
          {copy.addOption}
        </button>
      </div>
      <div className="grid gap-1.5">
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-2 px-1 text-xs font-medium text-[var(--color-text-muted)]">
          <span>{copy.optionLabel}</span>
          <span>{copy.sortOrder}</span>
          <span className="sr-only">{copy.deleteOption}</span>
        </div>
        {options.map((option) => (
          <div
            key={option.draftId}
            className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-2"
            data-testid="choice-option-draft-row"
          >
            {includeOptionIds ? (
              <input
                form={formId}
                name="choiceOptionId"
                type="hidden"
                value={option.id ?? ""}
              />
            ) : null}
            <input
              aria-label={copy.optionLabel}
              className={compactInputClassName}
              form={formId}
              name="choiceOptionLabel"
              placeholder={copy.optionLabel}
              value={option.label}
              onChange={(event) =>
                onUpdate(option.draftId, {
                  label: event.currentTarget.value
                })
              }
            />
            <input
              aria-label={copy.sortOrder}
              className={compactInputClassName}
              form={formId}
              name="choiceOptionSortOrder"
              placeholder={copy.sortOrder}
              type="number"
              value={option.sortOrder}
              onChange={(event) =>
                onUpdate(option.draftId, {
                  sortOrder: Number(event.currentTarget.value || "0")
                })
              }
            />
            <button
              className={compactSecondaryButtonClassName}
              type="button"
              onClick={() => onRemove(option.draftId)}
            >
              {copy.deleteOption}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function getFormString(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function getChoiceOptionsFromFormData(formData: FormData) {
  const labels = formData.getAll("choiceOptionLabel");
  const sortOrders = formData.getAll("choiceOptionSortOrder");

  return labels
    .map((label, index) => ({
      label: typeof label === "string" ? label.trim() : "",
      sortOrder: Number(
        typeof sortOrders[index] === "string" && sortOrders[index]
          ? sortOrders[index]
          : "0"
      )
    }))
    .filter((option) => option.label);
}

function getChoiceOptionUpdatesFromFormData(formData: FormData) {
  const ids = formData.getAll("choiceOptionId");
  const labels = formData.getAll("choiceOptionLabel");
  const sortOrders = formData.getAll("choiceOptionSortOrder");

  return labels
    .map((label, index) => ({
      id: typeof ids[index] === "string" && ids[index] ? ids[index] : undefined,
      label: typeof label === "string" ? label.trim() : "",
      sortOrder: Number(
        typeof sortOrders[index] === "string" && sortOrders[index]
          ? sortOrders[index]
          : "0"
      )
    }))
    .filter((option) => option.label);
}

function getChoiceOptionDrafts(
  choiceOptions: AttributeListItem["choiceOptions"]
): ChoiceOptionDraft[] {
  return choiceOptions.map((choiceOption, index) => ({
    draftId: index,
    id: choiceOption.id,
    label: choiceOption.label,
    sortOrder: choiceOption.sortOrder
  }));
}

function getNextDraftId(drafts: ChoiceOptionDraft[]) {
  if (drafts.length === 0) {
    return 0;
  }

  return Math.max(...drafts.map((draft) => draft.draftId)) + 1;
}

function getAttributeSuccessMessage(actionLabel: string, attributeName: string) {
  return `${actionLabel}: ${attributeName}.`;
}

function getErrorMessage(copy: Copy, error: string) {
  if (
    error.includes("required") ||
    error.includes("invalid") ||
    error.includes("not-found")
  ) {
    return copy.invalidInput;
  }

  if (error.includes("in-use")) {
    return error;
  }

  return copy.databaseUnavailable;
}

function validateAttributeForm(
  copy: Copy,
  formData: FormData
): AttributeFormErrors {
  const errors: AttributeFormErrors = {};

  if (!getFormString(formData, "name")) {
    errors.name = copy.invalidInput;
  }

  if (
    getFormString(formData, "type") === "QUANTITY" &&
    !getFormString(formData, "baseUnitSymbol")
  ) {
    errors.baseUnitSymbol = copy.invalidInput;
  }

  return errors;
}

function getAttributeFormErrors(copy: Copy, error: string): AttributeFormErrors {
  if (error === "attribute-name-required") {
    return { name: copy.invalidInput };
  }

  if (error === "quantity-unit-required") {
    return { baseUnitSymbol: copy.invalidInput };
  }

  return { submit: getErrorMessage(copy, error) };
}

function hasFieldErrors(errors: Record<string, string | undefined>) {
  return Object.values(errors).some(Boolean);
}

const labelClassName = "grid gap-2 text-sm font-medium text-[var(--color-text-secondary)]";
const inputClassName =
  "min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-placeholder)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]";
const primaryButtonClassName =
  "min-h-9 rounded-md border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:border-[var(--color-action-primary-hover)] hover:bg-[var(--color-action-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-focus)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:bg-[var(--color-bg-muted)] disabled:text-[var(--color-text-placeholder)]";
const compactInputClassName =
  "min-h-9 min-w-0 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-placeholder)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]";
const compactSecondaryButtonClassName =
  "min-h-9 whitespace-nowrap rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2.5 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]";
