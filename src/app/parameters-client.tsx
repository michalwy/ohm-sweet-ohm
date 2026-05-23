"use client";

import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";

import {
  createParameterForWorkspace,
  deleteParameterForWorkspace,
  getParameterDictionaryForWorkspace,
  updateParameterForWorkspace
} from "@/server/parts/parameterActions";
import type { ParameterListItem } from "@/server/parts/parameterMutations";
import type { ParameterValueType } from "@/server/parts/parameterValues";
import {
  getNextToastId,
  ToastNotice,
  type ToastMessage
} from "@/app/toast-notice";

type Copy = {
  title: string;
  addParameter: string;
  edit: string;
  delete: string;
  close: string;
  createParameter: string;
  saveChanges: string;
  addOption: string;
  deleteOption: string;
  newParameterTitle: string;
  editParameterTitle: string;
  name: string;
  description: string;
  type: string;
  baseUnit: string;
  options: string;
  noOptions: string;
  noParameters: string;
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

type ParametersClientProps = {
  canWriteParameters: boolean;
  copy: Copy;
  isDatabaseAvailable: boolean;
  parameters: ParameterListItem[];
  workspaceSlug: string;
};

type ChoiceOptionDraft = {
  draftId: number;
  id?: string;
  label: string;
  sortOrder: number;
};

type ParameterDialogMode = "create" | "edit";

export function ParametersClient({
  canWriteParameters,
  copy,
  isDatabaseAvailable,
  parameters,
  workspaceSlug
}: ParametersClientProps) {
  const parameterDialogRef = useRef<HTMLDialogElement>(null);
  const nextToastIdRef = useRef(0);
  const [currentParameters, setCurrentParameters] = useState(parameters);
  const [parameterDialogMode, setParameterDialogMode] =
    useState<ParameterDialogMode | null>(null);
  const [editingParameter, setEditingParameter] =
    useState<ParameterListItem | null>(null);
  const [dialogFormError, setDialogFormError] = useState<string | null>(null);
  const [dialogFormKey, setDialogFormKey] = useState(0);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);

  const refreshParametersMutation = useMutation({
    mutationFn: () => getParameterDictionaryForWorkspace(workspaceSlug),
    onSuccess: (result) => {
      if (result.ok) {
        setCurrentParameters(result.data);
      }
    }
  });
  const createParameterMutation = useMutation({
    mutationFn: createParameterForWorkspace,
    onSuccess: async (result) => {
      if (!result.ok) {
        setDialogFormError(result.error);
        return;
      }

      await refreshParametersMutation.mutateAsync();
      setDialogFormError(null);
      addToast(getParameterSuccessMessage(copy.createdToast, result.data.name));
      closeParameterDialog();
    },
    onError: () => setDialogFormError("database-unavailable")
  });
  const updateParameterMutation = useMutation({
    mutationFn: updateParameterForWorkspace,
    onSuccess: async (result) => {
      if (!result.ok) {
        setDialogFormError(result.error);
        return;
      }

      await refreshParametersMutation.mutateAsync();
      setDialogFormError(null);
      addToast(getParameterSuccessMessage(copy.updatedToast, result.data.name));
      closeParameterDialog();
    },
    onError: () => setDialogFormError("database-unavailable")
  });
  const deleteParameterMutation = useMutation({
    mutationFn: deleteParameterForWorkspace,
    onSuccess: async (result, variables) => {
      if (!result.ok) {
        setDialogFormError(result.error);
        return;
      }

      const deletedParameterName =
        currentParameters.find((parameter) => parameter.id === variables.parameterId)
          ?.name ?? editingParameter?.name ?? "";

      await refreshParametersMutation.mutateAsync();
      setDialogFormError(null);
      addToast(getParameterSuccessMessage(copy.deletedToast, deletedParameterName));
      closeParameterDialog();
    },
    onError: () => setDialogFormError("database-unavailable")
  });
  function openCreateDialog() {
    setEditingParameter(null);
    setParameterDialogMode("create");
    setDialogFormError(null);
    setDialogFormKey((currentKey) => currentKey + 1);
    window.requestAnimationFrame(() => openDialog(parameterDialogRef.current));
  }

  function openEditDialog(parameter: ParameterListItem) {
    setEditingParameter(parameter);
    setParameterDialogMode("edit");
    setDialogFormError(null);
    setDialogFormKey((currentKey) => currentKey + 1);
    window.requestAnimationFrame(() => openDialog(parameterDialogRef.current));
  }

  function handleCreateSubmit(formData: FormData) {
    createParameterMutation.mutate({
      workspaceSlug,
      name: getFormString(formData, "name"),
      description: getFormString(formData, "description"),
      type: getFormString(formData, "type") as ParameterValueType,
      baseUnitSymbol: getFormString(formData, "baseUnitSymbol"),
      choiceOptions: getChoiceOptionsFromFormData(formData)
    });
  }

  function handleUpdateSubmit(formData: FormData) {
    if (!editingParameter) {
      return;
    }

    updateParameterMutation.mutate({
      workspaceSlug,
      parameterId: editingParameter.id,
      name: getFormString(formData, "name"),
      description: getFormString(formData, "description"),
      type: getFormString(formData, "type") as ParameterValueType,
      baseUnitSymbol: getFormString(formData, "baseUnitSymbol"),
      choiceOptions: getChoiceOptionUpdatesFromFormData(formData)
    });
  }

  function closeParameterDialog() {
    closeDialog(parameterDialogRef.current);
    setParameterDialogMode(null);
    setEditingParameter(null);
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
        aria-labelledby="parameters-heading"
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      >
        <h2 id="parameters-heading" className="sr-only">
          {copy.title}
        </h2>
        <div className="flex items-center justify-end border-b border-slate-200 bg-white px-4 py-3">
          <button
            className="min-h-10 rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            disabled={!isDatabaseAvailable || !canWriteParameters}
            type="button"
            onClick={openCreateDialog}
          >
            {copy.addParameter}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {currentParameters.length > 0 ? (
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
                {currentParameters.map((parameter) => (
                  <tr key={parameter.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium text-slate-950">
                      {parameter.name}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {getTypeLabel(copy, parameter.type)}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {parameter.baseUnitSymbol ?? ""}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-slate-700">
                      <span className="line-clamp-2">
                        {parameter.choiceOptions.length > 0
                          ? parameter.choiceOptions
                              .map((option) => option.label)
                              .join(", ")
                          : copy.noOptions}
                      </span>
                    </td>
                    <td className="max-w-sm px-4 py-3 text-slate-500">
                      <span className="line-clamp-2">
                        {parameter.description ?? ""}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                        disabled={!isDatabaseAvailable || !canWriteParameters}
                        type="button"
                        onClick={() => openEditDialog(parameter)}
                      >
                        {copy.edit}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="p-6 text-sm text-slate-500">{copy.noParameters}</p>
          )}
        </div>
      </section>

      <ToastNotice messages={toastMessages} onDismiss={dismissToastMessage} />

      <dialog
        ref={parameterDialogRef}
        aria-labelledby="parameter-dialog-title"
        className="fixed inset-0 m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-3xl rounded-lg border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/40"
        onClose={() => {
          setParameterDialogMode(null);
          setEditingParameter(null);
          setDialogFormError(null);
        }}
      >
        {parameterDialogMode ? (
          <ParameterDialogContent
            key={`${parameterDialogMode}-${editingParameter?.id ?? "new"}-${dialogFormKey}`}
            copy={copy}
            error={dialogFormError}
            isDatabaseAvailable={isDatabaseAvailable}
            isPending={
              parameterDialogMode === "create"
                ? createParameterMutation.isPending
                : updateParameterMutation.isPending
            }
            mode={parameterDialogMode}
            parameter={editingParameter}
            onDelete={
              parameterDialogMode === "edit" && editingParameter
                ? () =>
                    deleteParameterMutation.mutate({
                      workspaceSlug,
                      parameterId: editingParameter.id
                    })
                : undefined
            }
            onSubmit={
              parameterDialogMode === "create"
                ? handleCreateSubmit
                : handleUpdateSubmit
            }
          />
        ) : null}
      </dialog>
    </>
  );
}

function ParameterDialogContent({
  copy,
  error,
  isDatabaseAvailable,
  isPending,
  mode,
  parameter,
  onDelete,
  onSubmit
}: {
  copy: Copy;
  error: string | null;
  isDatabaseAvailable: boolean;
  isPending: boolean;
  mode: ParameterDialogMode;
  parameter: ParameterListItem | null;
  onDelete?: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  const formId = "parameter-dialog-form";
  const [type, setType] = useState<ParameterValueType>(
    parameter?.type ?? "TEXT"
  );
  const [choiceOptionDrafts, setChoiceOptionDrafts] = useState<
    ChoiceOptionDraft[]
  >(
    mode === "edit" && parameter
      ? getChoiceOptionDrafts(parameter.choiceOptions)
      : [{ draftId: 0, label: "", sortOrder: 0 }]
  );
  const title =
    mode === "create" ? copy.newParameterTitle : copy.editParameterTitle;
  const submitLabel =
    mode === "create" ? copy.createParameter : copy.saveChanges;
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
    <div className="p-6">
      <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
        <h2
          id="parameter-dialog-title"
          className="text-lg font-semibold text-slate-950"
        >
          {title}
        </h2>
        <form method="dialog">
          <button className={secondaryButtonClassName} type="submit">
            {copy.close}
          </button>
        </form>
      </div>
      {error ? (
        <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {getErrorMessage(copy, error)}
        </p>
      ) : null}
      <form
        className="grid gap-4"
        id={formId}
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit(new FormData(event.currentTarget));
        }}
      >
        <label className={labelClassName}>
          {copy.name}
          <input
            className={inputClassName}
            defaultValue={parameter?.name ?? ""}
            disabled={!isDatabaseAvailable}
            name="name"
            required
          />
        </label>
        <label className={labelClassName}>
          {copy.description}
          <textarea
            className={`${inputClassName} min-h-24`}
            defaultValue={parameter?.description ?? ""}
            disabled={!isDatabaseAvailable}
            name="description"
          />
        </label>
        <div className="grid grid-cols-2 gap-4">
          <label className={labelClassName}>
            {copy.type}
            <select
              className={inputClassName}
              defaultValue={parameter?.type ?? "TEXT"}
              disabled={!isDatabaseAvailable}
              name="type"
              onChange={(event) =>
                setType(event.currentTarget.value as ParameterValueType)
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
              defaultValue={parameter?.baseUnitSymbol ?? ""}
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
        <div
          className={
            mode === "edit"
              ? "flex items-center justify-between border-t border-slate-200 pt-5"
              : "flex justify-end border-t border-slate-200 pt-5"
          }
        >
          {mode === "edit" && onDelete ? (
            <button
              className="min-h-10 rounded-md border border-rose-200 bg-white px-3 py-2 text-sm font-medium text-rose-700 transition hover:border-rose-300 hover:bg-rose-50 focus:outline-none focus:ring-2 focus:ring-rose-200 focus:ring-offset-2"
              type="button"
              onClick={onDelete}
            >
              {copy.delete}
            </button>
          ) : null}
          <button
            className="min-h-11 rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            disabled={!isDatabaseAvailable || isPending}
            type="submit"
          >
            {submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

function getTypeLabel(copy: Copy, type: ParameterValueType) {
  const labels: Record<ParameterValueType, string> = {
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
  choiceOptions: ParameterListItem["choiceOptions"]
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

function getParameterSuccessMessage(actionLabel: string, parameterName: string) {
  return `${actionLabel}: ${parameterName}.`;
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
  "min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const secondaryButtonClassName =
  "min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const compactInputClassName =
  "min-h-9 min-w-0 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
const compactSecondaryButtonClassName =
  "min-h-9 whitespace-nowrap rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";
