"use client";

import { useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createUnitForWorkspace,
  deleteUnitForWorkspace,
  updateUnitForWorkspace
} from "@/server/units/unitActions";
import type { UnitListItem } from "@/server/units/unitMutations";
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
  addUnit: string;
  edit: string;
  delete: string;
  close: string;
  cancelDelete: string;
  confirmDelete: string;
  deleteConfirmationBody: string;
  createUnit: string;
  saveChanges: string;
  newUnitTitle: string;
  editUnitTitle: string;
  name: string;
  symbol: string;
  allowsFraction: string;
  yes: string;
  no: string;
  actions: string;
  duplicateUnitName: string;
  unitInUse: string;
  unitNotFound: string;
  permissionDenied: string;
  databaseUnavailable: string;
  noUnits: string;
  createdToast: string;
  updatedToast: string;
  deletedToast: string;
  invalidInput: string;
};

type UnitsClientProps = {
  canWriteUnits: boolean;
  copy: Copy;
  initialUnits: UnitListItem[];
  isDatabaseAvailable: boolean;
  workspaceSlug: string;
};

type UnitDialogMode = "create" | "edit";
type UnitFormField = "name" | "symbol" | "submit" | "delete";
type UnitFormErrors = Partial<Record<UnitFormField, string>>;

export function UnitsClient({
  canWriteUnits,
  copy,
  initialUnits,
  isDatabaseAvailable,
  workspaceSlug
}: UnitsClientProps) {
  const queryClient = useQueryClient();
  const unitDialogRef = useRef<HTMLDialogElement>(null);
  const nextToastIdRef = useRef(0);
  const [unitDialogMode, setUnitDialogMode] = useState<UnitDialogMode | null>(
    null
  );
  const [editingUnit, setEditingUnit] = useState<UnitListItem | null>(null);
  const [unitPendingDelete, setUnitPendingDelete] = useState<UnitListItem | null>(
    null
  );
  const [unitFieldErrors, setUnitFieldErrors] = useState<UnitFormErrors>({});
  const [dialogFormKey, setDialogFormKey] = useState(0);
  const [toastMessages, setToastMessages] = useState<ToastMessage[]>([]);
  const [units, setUnits] = useState(initialUnits);
  const unitsById = useMemo(
    () => new Map(units.map((unit) => [unit.id, unit])),
    [units]
  );

  function refreshUnits(nextUnits: UnitListItem[]) {
    setUnits(nextUnits.sort((a, b) => a.name.localeCompare(b.name, "en")));
    void queryClient.invalidateQueries({
      queryKey: ["units-list", workspaceSlug]
    });
  }

  const createUnitMutation = useMutation({
    mutationFn: createUnitForWorkspace,
    onSuccess: async (result) => {
      if (!result.ok) {
        setUnitFieldErrors(getUnitFormErrors(copy, result.error));
        return;
      }

      refreshUnits([...units, result.data]);
      addToast(getUnitSuccessMessage(copy.createdToast, result.data.name));
      closeUnitDialog();
    },
    onError: () =>
      setUnitFieldErrors({
        submit: copy.invalidInput
      })
  });

  const updateUnitMutation = useMutation({
    mutationFn: updateUnitForWorkspace,
    onSuccess: async (result) => {
      if (!result.ok) {
        setUnitFieldErrors(getUnitFormErrors(copy, result.error));
        return;
      }

      refreshUnits(
        units.map((unit) => (unit.id === result.data.id ? result.data : unit))
      );
      addToast(getUnitSuccessMessage(copy.updatedToast, result.data.name));
      closeUnitDialog();
    },
    onError: () =>
      setUnitFieldErrors({
        submit: copy.invalidInput
      })
  });

  const deleteUnitMutation = useMutation({
    mutationFn: deleteUnitForWorkspace,
    onSuccess: async (result, variables) => {
      if (!result.ok) {
        setUnitFieldErrors({
          delete: getErrorMessage(copy, result.error)
        });
        return;
      }

      const deletedUnitName =
        unitsById.get(variables.unitId)?.name ?? editingUnit?.name ?? "";
      refreshUnits(units.filter((unit) => unit.id !== variables.unitId));
      addToast(getUnitSuccessMessage(copy.deletedToast, deletedUnitName));
      closeUnitDialog();
    },
    onError: () =>
      setUnitFieldErrors({
        delete: copy.invalidInput
      })
  });

  function openCreateDialog() {
    setEditingUnit(null);
    setUnitDialogMode("create");
    setUnitFieldErrors({});
    setDialogFormKey((currentKey) => currentKey + 1);
    window.requestAnimationFrame(() => openDialog(unitDialogRef.current));
  }

  function openEditDialog(unit: UnitListItem) {
    setEditingUnit(unit);
    setUnitDialogMode("edit");
    setUnitFieldErrors({});
    setDialogFormKey((currentKey) => currentKey + 1);
    window.requestAnimationFrame(() => openDialog(unitDialogRef.current));
  }

  function closeUnitDialog() {
    closeDialog(unitDialogRef.current);
    setUnitDialogMode(null);
    setEditingUnit(null);
    setUnitPendingDelete(null);
    setUnitFieldErrors({});
  }

  function handleCreateSubmit(formData: FormData) {
    const fieldErrors = validateUnitForm(copy, formData);
    setUnitFieldErrors(fieldErrors);

    if (hasFieldErrors(fieldErrors)) {
      return;
    }

    createUnitMutation.mutate({
      workspaceSlug,
      name: getFormString(formData, "name"),
      symbol: getFormString(formData, "symbol"),
      allowsFraction: getFormString(formData, "allowsFraction") === "true"
    });
  }

  function handleUpdateSubmit(formData: FormData) {
    if (!editingUnit) {
      return;
    }

    const fieldErrors = validateUnitForm(copy, formData);
    setUnitFieldErrors(fieldErrors);

    if (hasFieldErrors(fieldErrors)) {
      return;
    }

    updateUnitMutation.mutate({
      workspaceSlug,
      unitId: editingUnit.id,
      name: getFormString(formData, "name"),
      symbol: getFormString(formData, "symbol"),
      allowsFraction: getFormString(formData, "allowsFraction") === "true"
    });
  }

  function handleDeleteUnit() {
    if (!editingUnit) {
      return;
    }

    setUnitPendingDelete(editingUnit);
  }

  function confirmDeleteUnit() {
    if (!unitPendingDelete) {
      return;
    }

    setUnitFieldErrors({});
    deleteUnitMutation.mutate({
      workspaceSlug,
      unitId: unitPendingDelete.id
    });
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
    <section className="flex min-h-0 flex-1 flex-col">
      <div className="mb-3 flex justify-end">
        <button
          className="inline-flex min-h-10 items-center rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          type="button"
          disabled={!canWriteUnits || !isDatabaseAvailable}
          onClick={openCreateDialog}
        >
          {copy.addUnit}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-md border border-slate-200 bg-white">
        {units.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-600">{copy.noUnits}</p>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 font-semibold text-slate-700">{copy.name}</th>
                <th className="px-4 py-3 font-semibold text-slate-700">{copy.symbol}</th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  {copy.allowsFraction}
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700">
                  {copy.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit) => (
                <tr key={unit.id} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-4 py-3 text-slate-900">{unit.name}</td>
                  <td className="px-4 py-3 font-mono text-slate-700">{unit.symbol}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {unit.allowsFraction ? copy.yes : copy.no}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      className="min-h-9 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={copy.edit}
                      type="button"
                      disabled={!canWriteUnits}
                      onClick={() => openEditDialog(unit)}
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <DialogShell
        ref={unitDialogRef}
        closeLabel={copy.close}
        title={unitDialogMode === "create" ? copy.newUnitTitle : copy.editUnitTitle}
        titleId="unit-dialog-title"
        widthClassName="w-[min(32rem,calc(100vw-3rem))]"
      >
        {unitDialogMode ? (
          <form
            key={dialogFormKey}
            action={
              unitDialogMode === "create"
                ? handleCreateSubmit
                : handleUpdateSubmit
            }
            className="flex min-h-0 flex-1 flex-col overflow-hidden"
          >
            <DialogBody className="grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                <LabelWithError error={unitFieldErrors.name} htmlFor="unit-name">
                  {copy.name}
                </LabelWithError>
                <input
                  id="unit-name"
                  name="name"
                  defaultValue={editingUnit?.name ?? ""}
                  className={getFieldInputClassName(
                    "min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200",
                    Boolean(unitFieldErrors.name)
                  )}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium text-slate-700">
                <LabelWithError error={unitFieldErrors.symbol} htmlFor="unit-symbol">
                  {copy.symbol}
                </LabelWithError>
                <input
                  id="unit-symbol"
                  name="symbol"
                  defaultValue={editingUnit?.symbol ?? ""}
                  className={getFieldInputClassName(
                    "min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200",
                    Boolean(unitFieldErrors.symbol)
                  )}
                />
              </label>
              <label className="inline-flex items-center gap-2 text-sm text-slate-800">
                <input
                  type="checkbox"
                  name="allowsFraction"
                  value="true"
                  defaultChecked={editingUnit?.allowsFraction ?? false}
                />
                {copy.allowsFraction}
              </label>
            </DialogBody>
            <DialogFooter className="items-end justify-between">
              <div className="relative">
                {unitDialogMode === "edit" ? (
                  <button
                    className="min-h-10 rounded-md border border-red-300 px-3 text-sm font-medium text-red-700 transition hover:border-red-400 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    type="button"
                    disabled={deleteUnitMutation.isPending || !canWriteUnits}
                    onClick={handleDeleteUnit}
                  >
                    {copy.delete}
                  </button>
                ) : null}
                {unitFieldErrors.delete ? (
                  <ErrorBubble align="start">{unitFieldErrors.delete}</ErrorBubble>
                ) : null}
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="min-h-10 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  type="button"
                  onClick={closeUnitDialog}
                >
                  {copy.close}
                </button>
                <button
                  className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                  type="submit"
                  disabled={
                    createUnitMutation.isPending ||
                    updateUnitMutation.isPending ||
                    !canWriteUnits
                  }
                >
                  {unitDialogMode === "create" ? copy.createUnit : copy.saveChanges}
                </button>
              </div>
            </DialogFooter>
            {unitFieldErrors.submit ? (
              <ErrorBubble>{unitFieldErrors.submit}</ErrorBubble>
            ) : null}
          </form>
        ) : null}
      </DialogShell>

      <DeleteConfirmationDialog
        body={copy.deleteConfirmationBody}
        cancelLabel={copy.cancelDelete}
        closeLabel={copy.close}
        confirmLabel={copy.confirmDelete}
        deleteLabel={copy.delete}
        isPending={deleteUnitMutation.isPending}
        itemName={
          unitPendingDelete ? `${unitPendingDelete.name} (${unitPendingDelete.symbol})` : ""
        }
        open={Boolean(unitPendingDelete)}
        onCancel={() => setUnitPendingDelete(null)}
        onConfirm={confirmDeleteUnit}
      />

      <ToastNotice messages={toastMessages} onDismiss={dismissToastMessage} />
    </section>
  );
}

function validateUnitForm(copy: Copy, formData: FormData): UnitFormErrors {
  const errors: UnitFormErrors = {};
  const name = getFormString(formData, "name");
  const symbol = getFormString(formData, "symbol");

  if (!name) {
    errors.name = copy.invalidInput;
  }

  if (!symbol) {
    errors.symbol = copy.invalidInput;
  }

  return errors;
}

function getUnitFormErrors(copy: Copy, error: string): UnitFormErrors {
  if (error === "duplicate-unit-name") {
    return {
      name: copy.duplicateUnitName
    };
  }

  if (error === "unit-in-use") {
    return {
      delete: copy.unitInUse
    };
  }

  if (error === "unit-not-found") {
    return {
      submit: copy.unitNotFound
    };
  }

  return {
    submit: getErrorMessage(copy, error)
  };
}

function getErrorMessage(copy: Copy, error: string) {
  if (error === "permission-denied") {
    return copy.permissionDenied;
  }

  if (error === "database-unavailable") {
    return copy.databaseUnavailable;
  }

  return copy.invalidInput;
}

function getUnitSuccessMessage(actionLabel: string, unitName: string) {
  return unitName ? `${actionLabel}: ${unitName}.` : actionLabel;
}

function hasFieldErrors(errors: UnitFormErrors) {
  return Object.values(errors).some(Boolean);
}

function getFormString(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}
