"use client";

import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";

import {
  createAttributeForWorkspace,
  deleteAttributeForWorkspace,
  getAttributeDictionaryForWorkspace,
  updateAttributeForWorkspace
} from "@/server/parts/attributeActions";
import type { AttributeListItem } from "@/server/parts/attributeMutations";
import type { AttributeValueType } from "@/server/parts/attributeValues";
import {
  getNextToastId,
  ToastNotice,
  type ToastMessage
} from "@/app/toast-notice";
import { DialogBody, DialogFooter, DialogShell } from "@/app/dialog-shell";

type Copy = {
  title: string;
  addAttribute: string;
  edit: string;
  delete: string;
  close: string;
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

type AttributesClientProps = {
  canWriteAttributes: boolean;
  copy: Copy;
  isDatabaseAvailable: boolean;
  attributes: AttributeListItem[];
  workspaceSlug: string;
};

type ChoiceOptionDraft = {
  draftId: number;
  id?: string;
  label: string;
  sortOrder: number;
};

type AttributeDialogMode = "create" | "edit";

export function AttributesClient({
  canWriteAttributes,
  copy,
  isDatabaseAvailable,
  attributes,
  workspaceSlug
}: AttributesClientProps) {
  const attributeDialogRef = useRef<HTMLDialogElement>(null);
  const nextToastIdRef = useRef(0);
  const [currentAttributes, setCurrentAttributes] = useState(attributes);
  const [attributeDialogMode, setAttributeDialogMode] =
    useState<AttributeDialogMode | null>(null);
  const [editingAttribute, setEditingAttribute] =
    useState<AttributeListItem | null>(null);
  const [dialogFormError, setDialogFormError] = useState<string | null>(null);
  const [dialogFormKey, setDialogFormKey] = useState(0);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);

  const refreshAttributesMutation = useMutation({
    mutationFn: () => getAttributeDictionaryForWorkspace(workspaceSlug),
    onSuccess: (result) => {
      if (result.ok) {
        setCurrentAttributes(result.data);
      }
    }
  });
  const createAttributeMutation = useMutation({
    mutationFn: createAttributeForWorkspace,
    onSuccess: async (result) => {
      if (!result.ok) {
        setDialogFormError(result.error);
        return;
      }

      await refreshAttributesMutation.mutateAsync();
      setDialogFormError(null);
      addToast(getAttributeSuccessMessage(copy.createdToast, result.data.name));
      closeAttributeDialog();
    },
    onError: () => setDialogFormError("database-unavailable")
  });
  const updateAttributeMutation = useMutation({
    mutationFn: updateAttributeForWorkspace,
    onSuccess: async (result) => {
      if (!result.ok) {
        setDialogFormError(result.error);
        return;
      }

      await refreshAttributesMutation.mutateAsync();
      setDialogFormError(null);
      addToast(getAttributeSuccessMessage(copy.updatedToast, result.data.name));
      closeAttributeDialog();
    },
    onError: () => setDialogFormError("database-unavailable")
  });
  const deleteAttributeMutation = useMutation({
    mutationFn: deleteAttributeForWorkspace,
    onSuccess: async (result, variables) => {
      if (!result.ok) {
        setDialogFormError(result.error);
        return;
      }

      const deletedAttributeName =
        currentAttributes.find((attribute) => attribute.id === variables.attributeId)
          ?.name ?? editingAttribute?.name ?? "";

      await refreshAttributesMutation.mutateAsync();
      setDialogFormError(null);
      addToast(getAttributeSuccessMessage(copy.deletedToast, deletedAttributeName));
      closeAttributeDialog();
    },
    onError: () => setDialogFormError("database-unavailable")
  });
  function openCreateDialog() {
    setEditingAttribute(null);
    setAttributeDialogMode("create");
    setDialogFormError(null);
    setDialogFormKey((currentKey) => currentKey + 1);
    window.requestAnimationFrame(() => openDialog(attributeDialogRef.current));
  }

  function openEditDialog(attribute: AttributeListItem) {
    setEditingAttribute(attribute);
    setAttributeDialogMode("edit");
    setDialogFormError(null);
    setDialogFormKey((currentKey) => currentKey + 1);
    window.requestAnimationFrame(() => openDialog(attributeDialogRef.current));
  }

  function handleCreateSubmit(formData: FormData) {
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

  function closeAttributeDialog() {
    closeDialog(attributeDialogRef.current);
    setAttributeDialogMode(null);
    setEditingAttribute(null);
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
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      >
        <h2 id="attributes-heading" className="sr-only">
          {copy.title}
        </h2>
        <div className="flex items-center justify-end border-b border-slate-200 bg-white px-4 py-3">
          <button
            className={primaryButtonClassName}
            disabled={!isDatabaseAvailable || !canWriteAttributes}
            type="button"
            onClick={openCreateDialog}
          >
            {copy.addAttribute}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {currentAttributes.length > 0 ? (
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                    {copy.name}
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                    {copy.type}
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                    {copy.baseUnit}
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                    {copy.options}
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                    {copy.description}
                  </th>
                  <th className="w-24 border-b border-slate-200 px-4 py-3 font-semibold">
                    {copy.edit}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentAttributes.map((attribute) => (
                  <tr key={attribute.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium text-slate-950">
                      {attribute.name}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {getTypeLabel(copy, attribute.type)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {attribute.baseUnitSymbol ?? ""}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-700">
                      <span className="line-clamp-2">
                        {attribute.choiceOptions.length > 0
                          ? attribute.choiceOptions
                              .map((option) => option.label)
                              .join(", ")
                          : copy.noOptions}
                      </span>
                    </td>
                    <td className="max-w-sm px-4 py-3 text-slate-500">
                      <span className="line-clamp-2">
                        {attribute.description ?? ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                        disabled={!isDatabaseAvailable || !canWriteAttributes}
                        type="button"
                        onClick={() => openEditDialog(attribute)}
                      >
                        {copy.edit}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-6 text-sm text-slate-500">{copy.noAttributes}</p>
          )}
        </div>
      </section>

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
          setDialogFormError(null);
        }}
      >
        {attributeDialogMode ? (
          <AttributeDialogContent
            key={`${attributeDialogMode}-${editingAttribute?.id ?? "new"}-${dialogFormKey}`}
            copy={copy}
            error={dialogFormError}
            isDatabaseAvailable={isDatabaseAvailable}
            isPending={
              attributeDialogMode === "create"
                ? createAttributeMutation.isPending
                : updateAttributeMutation.isPending
            }
            mode={attributeDialogMode}
            attribute={editingAttribute}
            onDelete={
              attributeDialogMode === "edit" && editingAttribute
                ? () =>
                    deleteAttributeMutation.mutate({
                      workspaceSlug,
                      attributeId: editingAttribute.id
                    })
                : undefined
            }
            onSubmit={
              attributeDialogMode === "create"
                ? handleCreateSubmit
                : handleUpdateSubmit
            }
          />
        ) : null}
      </DialogShell>
    </>
  );
}

function AttributeDialogContent({
  copy,
  error,
  isDatabaseAvailable,
  isPending,
  mode,
  attribute,
  onDelete,
  onSubmit
}: {
  copy: Copy;
  error: string | null;
  isDatabaseAvailable: boolean;
  isPending: boolean;
  mode: AttributeDialogMode;
  attribute: AttributeListItem | null;
  onDelete?: () => void;
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
          {error ? (
            <p className="mb-3 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-soft)] px-3 py-2 text-sm text-[var(--color-error)]">
              {getErrorMessage(copy, error)}
            </p>
          ) : null}
          <div className="grid gap-3">
            <label className={labelClassName}>
              {copy.name}
              <input
                className={inputClassName}
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
            {copy.baseUnit}
            <input
              className={inputClassName}
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
          className={
            mode === "edit"
              ? "items-center justify-between"
              : "justify-end"
          }
        >
          {mode === "edit" && onDelete ? (
            <button
              className="min-h-9 rounded-md border border-[var(--color-error-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2"
              type="button"
              onClick={onDelete}
            >
              {copy.delete}
            </button>
          ) : null}
          <button
            className={primaryButtonClassName}
            disabled={!isDatabaseAvailable || isPending}
            type="submit"
          >
            {submitLabel}
          </button>
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
    <div className="mt-4 border-t border-slate-200 pt-4">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-950">{copy.options}</h3>
        <button
          className={compactSecondaryButtonClassName}
          type="button"
          onClick={onAdd}
        >
          {copy.addOption}
        </button>
      </div>
      <div className="grid gap-1.5">
        <div className="grid grid-cols-[minmax(0,1fr)_5.5rem_5.5rem] gap-2 px-1 text-xs font-medium text-slate-500">
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

const labelClassName = "grid gap-2 text-sm font-medium text-slate-700";
const inputClassName =
  "min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const primaryButtonClassName =
  "min-h-9 rounded-md border border-[var(--color-action-primary)] bg-[var(--color-action-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:border-[var(--color-action-primary-hover)] hover:bg-[var(--color-action-primary-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-focus)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400";
const compactInputClassName =
  "min-h-9 min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const compactSecondaryButtonClassName =
  "min-h-9 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
