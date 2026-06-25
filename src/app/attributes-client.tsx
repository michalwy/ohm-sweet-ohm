"use client";

import {
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
  getNextToastId,
  ToastNotice,
  type ToastMessage
} from "@/app/toast-notice";
import {
  DeleteConfirmationDialog,
  DialogBody,
  DialogFooter,
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
};

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
  const attributesQuery = useInfiniteQuery({
    queryKey: ["attributes-list", workspaceSlug],
    enabled: isDatabaseAvailable,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const result = await getAttributeDictionaryPageForWorkspace({
        workspaceSlug,
        cursor: pageParam
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      return result.data;
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialData: {
      pages: [initialPage],
      pageParams: [null]
    }
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

  return (
    <>
      <section
        aria-labelledby="attributes-heading"
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-elevated)] shadow-sm"
      >
        <h2 id="attributes-heading" className="sr-only">
          {copy.title}
        </h2>
        <div className="flex items-center justify-end border-b border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-3">
          <button
            className={primaryButtonClassName}
            disabled={!isDatabaseAvailable || !canWriteAttributes}
            type="button"
            onClick={openCreateDialog}
          >
            {copy.addAttribute}
          </button>
        </div>
        <InfiniteListViewport
          emptyState={<p className="p-6 text-sm text-[var(--color-text-muted)]">{copy.noAttributes}</p>}
          errorState={
            <p className="p-6 text-sm text-[var(--color-text-muted)]">
              {copy.databaseUnavailable}
            </p>
          }
          hasNextPage={Boolean(attributesQuery.hasNextPage)}
          isEmpty={currentAttributes.length === 0}
          isError={attributesQuery.isError}
          isFetchingNextPage={attributesQuery.isFetchingNextPage}
          isInitialLoading={attributesQuery.isLoading}
          loadingLabel={copy.loadingAttributes}
          loadingMoreLabel={copy.loadingMoreAttributes}
          loadMore={() => {
            void attributesQuery.fetchNextPage();
          }}
          testId="attributes-list-viewport"
        >
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-[var(--color-bg-subtle)] text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                <tr>
                  <th className="border-b border-[var(--color-border)] px-4 py-3 font-semibold">
                    {copy.name}
                  </th>
                  <th className="border-b border-[var(--color-border)] px-4 py-3 font-semibold">
                    {copy.type}
                  </th>
                  <th className="border-b border-[var(--color-border)] px-4 py-3 font-semibold">
                    {copy.baseUnit}
                  </th>
                  <th className="border-b border-[var(--color-border)] px-4 py-3 font-semibold">
                    {copy.options}
                  </th>
                  <th className="border-b border-[var(--color-border)] px-4 py-3 font-semibold">
                    {copy.description}
                  </th>
                  <th className="w-36 border-b border-[var(--color-border)] px-4 py-3 font-semibold">
                    {copy.actions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {currentAttributes.map((attribute) => (
                  <tr key={attribute.id} className="hover:bg-[var(--color-bg-subtle)]/70">
                    <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                      {attribute.name}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {getTypeLabel(copy, attribute.type)}
                    </td>
                    <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                      {attribute.baseUnitSymbol ?? ""}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-[var(--color-text-secondary)]">
                      <span className="line-clamp-2">
                        {attribute.choiceOptions.length > 0
                          ? attribute.choiceOptions
                              .map((option) => option.label)
                              .join(", ")
                          : copy.noOptions}
                      </span>
                    </td>
                    <td className="max-w-sm px-4 py-3 text-[var(--color-text-muted)]">
                      <span className="line-clamp-2">
                        {attribute.description ?? ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          className="min-h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
                          aria-label={copy.edit}
                          disabled={!isDatabaseAvailable || !canWriteAttributes}
                          type="button"
                          onClick={() => openEditDialog(attribute)}
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
                          className="min-h-9 rounded-md border border-[var(--color-error-border)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]"
                          aria-label={copy.delete}
                          disabled={
                            !isDatabaseAvailable ||
                            !canWriteAttributes ||
                            deleteAttributeMutation.isPending
                          }
                          type="button"
                          onClick={() => handleDeleteAttribute(attribute)}
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
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
        </InfiniteListViewport>
      </section>
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
            onCancel={() => {
              setAttributeDialogMode(null);
              setEditingAttribute(null);
            }}
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
  onSubmit,
  onCancel
}: {
  copy: Copy;
  errors: AttributeFormErrors;
  isDatabaseAvailable: boolean;
  isPending: boolean;
  mode: AttributeDialogMode;
  attribute: AttributeListItem | null;
  onSubmit: (formData: FormData) => void;
  onCancel: () => void;
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
        <DialogFooter
          className="items-center justify-between gap-3"
        >
          <button
            className="min-h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring-strong)] focus:ring-offset-2"
            type="button"
            onClick={onCancel}
          >
            {copy.cancelDelete}
          </button>
          <div className="relative">
            <ErrorBubble>{errors.submit}</ErrorBubble>
            <button
              className={primaryButtonClassName}
              disabled={!isDatabaseAvailable || isPending}
              type="submit"
            >
              {submitLabel}
            </button>
          </div>
        </DialogFooter>
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
