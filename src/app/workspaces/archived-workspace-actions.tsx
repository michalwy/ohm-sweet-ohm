"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  DialogBody,
  DialogFooter,
  DialogShell,
  openDialog,
  closeDialog
} from "@/app/dialog-shell";
import { restoreWorkspaceFromPicker, scheduleWorkspaceDeletion } from "@/server/workspaces/actions";

type ArchivedWorkspaceActionsProps = {
  workspaceName: string;
  workspaceSlug: string;
  deletionScheduledAt: Date | null;
};

const copy = {
  restore: "Restore",
  permanentlyDelete: "Permanently delete",
  deletionInProgress: "Deletion in progress",
  dialogTitle: "Permanently delete workspace?",
  dialogBody: (name: string) =>
    `This will permanently delete "${name}" and all its data. This action cannot be undone.`,
  confirmInstruction: "Type the workspace name to confirm:",
  confirmPlaceholder: "Workspace name",
  delete: "Delete",
  cancel: "Cancel",
  close: "Close",
  permissionDenied: "You do not have permission to delete this workspace.",
  unavailable: "Deletion could not be scheduled. Please try again."
};

export function ArchivedWorkspaceActions({
  workspaceName,
  workspaceSlug,
  deletionScheduledAt
}: ArchivedWorkspaceActionsProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmInput, setConfirmInput] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const canConfirm = confirmInput.trim() === workspaceName;

  const mutation = useMutation({
    mutationFn: () => scheduleWorkspaceDeletion(workspaceSlug),
    onSuccess: (result) => {
      if (!result.ok) {
        setErrorMsg(
          result.error === "workspace-permission-denied"
            ? copy.permissionDenied
            : copy.unavailable
        );
        return;
      }
      closeDialog(dialogRef.current);
      window.location.reload();
    }
  });

  function handleOpenDialog() {
    setConfirmInput("");
    setErrorMsg(null);
    openDialog(dialogRef.current);
  }

  function handleCloseDialog() {
    if (!mutation.isPending) {
      setConfirmInput("");
      setErrorMsg(null);
      closeDialog(dialogRef.current);
    }
  }

  if (deletionScheduledAt) {
    return (
      <p className="mt-1 text-xs font-medium text-[var(--color-error)]">
        {copy.deletionInProgress}
      </p>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <form action={restoreWorkspaceFromPicker}>
        <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
        <button
          className="inline-flex min-h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
          type="submit"
        >
          {copy.restore}
        </button>
      </form>

      <button
        className="inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--color-error-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2"
        type="button"
        onClick={handleOpenDialog}
      >
        {copy.permanentlyDelete}
      </button>

      <DialogShell
        ref={dialogRef}
        closeLabel={copy.close}
        title={copy.dialogTitle}
        titleId="permanently-delete-workspace-dialog-title"
        widthClassName="w-[min(32rem,calc(100vw-3rem))]"
        onClose={() => {
          if (!mutation.isPending) {
            setConfirmInput("");
            setErrorMsg(null);
          }
        }}
        onCloseClick={handleCloseDialog}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (canConfirm) mutation.mutate();
          }}
        >
          <DialogBody>
            <p className="text-sm leading-6 text-slate-600">{copy.dialogBody(workspaceName)}</p>
            <div className="mt-4 grid gap-1.5">
              <label
                className="text-sm font-medium text-slate-700"
                htmlFor="delete-workspace-confirm-input"
              >
                {copy.confirmInstruction}
              </label>
              <input
                autoComplete="off"
                className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
                data-dialog-initial-focus
                disabled={mutation.isPending}
                id="delete-workspace-confirm-input"
                placeholder={copy.confirmPlaceholder}
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
              />
            </div>
            {errorMsg && (
              <p className="mt-3 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-soft)] px-3 py-2 text-sm text-[var(--color-error)]">
                {errorMsg}
              </p>
            )}
          </DialogBody>
          <DialogFooter className="items-center justify-end gap-2">
            <button
              className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={mutation.isPending}
              type="button"
              onClick={handleCloseDialog}
            >
              {copy.cancel}
            </button>
            <button
              className="min-h-9 rounded-md border border-[var(--color-error-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={!canConfirm || mutation.isPending}
              type="submit"
            >
              {copy.delete}
            </button>
          </DialogFooter>
        </form>
      </DialogShell>
    </div>
  );
}
