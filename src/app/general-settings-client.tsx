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
import { archiveWorkspace } from "@/server/workspaces/actions";

type GeneralSettingsClientProps = {
  canArchive: boolean;
  workspaceName: string;
  workspaceSlug: string;
};

const copy = {
  workspaceName: "Workspace name",
  workspaceSlug: "Workspace URL",
  dangerZone: "Danger zone",
  archiveWorkspace: "Archive workspace",
  archiveIntro:
    "Archiving removes this workspace from your active list and makes it inaccessible to members. All data is preserved and the workspace can be restored from the Workspaces page.",
  confirmTitle: "Archive workspace?",
  confirmBody:
    "This removes the workspace from your active list and makes it inaccessible to members. All data is preserved. You can restore it from the Workspaces page.",
  confirmArchive: "Archive",
  cancel: "Cancel",
  close: "Close",
  permissionDenied: "You do not have permission to archive this workspace.",
  unavailable: "Archiving failed. Please try again."
};

export function GeneralSettingsClient({
  canArchive,
  workspaceName,
  workspaceSlug
}: GeneralSettingsClientProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => archiveWorkspace(workspaceSlug),
    onSuccess: (result) => {
      closeDialog(dialogRef.current);
      if (!result.ok) {
        setErrorMsg(
          result.error === "workspace-permission-denied"
            ? copy.permissionDenied
            : copy.unavailable
        );
        return;
      }
      window.location.assign(result.redirectTo);
    }
  });

  return (
    <div className="max-w-lg space-y-8">
      <div className="space-y-4">
        <div className="grid gap-1">
          <p className="text-sm font-medium text-slate-700">{copy.workspaceName}</p>
          <p className="text-sm text-slate-950">{workspaceName}</p>
        </div>
        <div className="grid gap-1">
          <p className="text-sm font-medium text-slate-700">{copy.workspaceSlug}</p>
          <p className="font-mono text-sm text-slate-500">/w/{workspaceSlug}</p>
        </div>
      </div>

      {canArchive && (
        <div className="rounded-lg border border-[var(--color-error-border)] p-4">
          <p className="text-sm font-semibold text-slate-950">{copy.dangerZone}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{copy.archiveIntro}</p>
          {errorMsg && (
            <p className="mt-3 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-soft)] px-3 py-2 text-sm text-[var(--color-error)]">
              {errorMsg}
            </p>
          )}
          <button
            className="mt-3 min-h-9 rounded-md border border-[var(--color-error-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2"
            type="button"
            onClick={() => openDialog(dialogRef.current)}
          >
            {copy.archiveWorkspace}
          </button>
        </div>
      )}

      <DialogShell
        ref={dialogRef}
        closeLabel={copy.close}
        title={copy.confirmTitle}
        titleId="archive-workspace-dialog-title"
        widthClassName="w-[min(32rem,calc(100vw-3rem))]"
        onClose={() => {
          if (!mutation.isPending) setErrorMsg(null);
        }}
        onCloseClick={() => closeDialog(dialogRef.current)}
      >
        <DialogBody>
          <p className="text-sm leading-6 text-slate-600">{copy.confirmBody}</p>
        </DialogBody>
        <DialogFooter className="items-center justify-end gap-2">
          <button
            className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            data-dialog-initial-focus
            disabled={mutation.isPending}
            type="button"
            onClick={() => closeDialog(dialogRef.current)}
          >
            {copy.cancel}
          </button>
          <button
            className="min-h-9 rounded-md border border-[var(--color-error-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={mutation.isPending}
            type="button"
            onClick={() => mutation.mutate()}
          >
            {copy.confirmArchive}
          </button>
        </DialogFooter>
      </DialogShell>
    </div>
  );
}
