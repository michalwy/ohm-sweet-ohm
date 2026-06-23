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
import { archiveWorkspace, resetWorkspaceToDemoPreset } from "@/server/workspaces/actions";

type GeneralSettingsClientProps = {
  canArchive: boolean;
  canReset: boolean;
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
  resetWorkspace: "Reset to demo data",
  resetIntro:
    "Replace all workspace data with a fresh demo preset. All current parts, inventory, categories, locations, purchase orders, and shopping lists will be permanently deleted.",
  resetConfirmTitle: "Reset workspace to demo data?",
  resetConfirmBody:
    "This will permanently delete all current workspace data — parts, inventory entries, purchase orders, shopping lists, categories, locations, attributes, and organizations. This cannot be undone. The workspace itself (name, URL, and members) will be preserved.",
  presetPartsOnly: "Parts only",
  presetPartsAndOrders: "Parts + POs & shopping lists",
  resetButton: "Reset workspace",
  cancel: "Cancel",
  close: "Close",
  permissionDenied: "You do not have permission to archive this workspace.",
  unavailable: "Archiving failed. Please try again.",
  resetPermissionDenied: "You do not have permission to reset this workspace.",
  resetUnavailable: "Reset failed. Please try again."
};

export function GeneralSettingsClient({
  canArchive,
  canReset,
  workspaceName,
  workspaceSlug
}: GeneralSettingsClientProps) {
  const archiveDialogRef = useRef<HTMLDialogElement>(null);
  const resetDialogRef = useRef<HTMLDialogElement>(null);
  const [archiveErrorMsg, setArchiveErrorMsg] = useState<string | null>(null);
  const [resetErrorMsg, setResetErrorMsg] = useState<string | null>(null);
  const [resetPreset, setResetPreset] = useState<"parts-only" | "parts-and-orders">("parts-only");

  const archiveMutation = useMutation({
    mutationFn: () => archiveWorkspace(workspaceSlug),
    onSuccess: (result) => {
      closeDialog(archiveDialogRef.current);
      if (!result.ok) {
        setArchiveErrorMsg(
          result.error === "workspace-permission-denied"
            ? copy.permissionDenied
            : copy.unavailable
        );
        return;
      }
      window.location.assign(result.redirectTo);
    }
  });

  const resetMutation = useMutation({
    mutationFn: () => resetWorkspaceToDemoPreset(workspaceSlug, resetPreset),
    onSuccess: (result) => {
      closeDialog(resetDialogRef.current);
      if (!result.ok) {
        setResetErrorMsg(
          result.error === "workspace-permission-denied"
            ? copy.resetPermissionDenied
            : copy.resetUnavailable
        );
        return;
      }
      window.location.assign(`/w/${workspaceSlug}/parts`);
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

      {(canArchive || canReset) && (
        <div className="rounded-lg border border-[var(--color-error-border)] p-4 space-y-6">
          <p className="text-sm font-semibold text-slate-950">{copy.dangerZone}</p>

          {canReset && (
            <div>
              <p className="text-sm font-medium text-slate-700">{copy.resetWorkspace}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{copy.resetIntro}</p>
              {resetErrorMsg && (
                <p className="mt-3 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-soft)] px-3 py-2 text-sm text-[var(--color-error)]">
                  {resetErrorMsg}
                </p>
              )}
              <button
                className="mt-3 min-h-9 rounded-md border border-[var(--color-error-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2"
                type="button"
                onClick={() => openDialog(resetDialogRef.current)}
              >
                {copy.resetWorkspace}
              </button>
            </div>
          )}

          {canArchive && (
            <div>
              <p className="text-sm font-medium text-slate-700">{copy.archiveWorkspace}</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">{copy.archiveIntro}</p>
              {archiveErrorMsg && (
                <p className="mt-3 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-soft)] px-3 py-2 text-sm text-[var(--color-error)]">
                  {archiveErrorMsg}
                </p>
              )}
              <button
                className="mt-3 min-h-9 rounded-md border border-[var(--color-error-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2"
                type="button"
                onClick={() => openDialog(archiveDialogRef.current)}
              >
                {copy.archiveWorkspace}
              </button>
            </div>
          )}
        </div>
      )}

      <DialogShell
        ref={archiveDialogRef}
        closeLabel={copy.close}
        title={copy.confirmTitle}
        titleId="archive-workspace-dialog-title"
        widthClassName="w-[min(32rem,calc(100vw-3rem))]"
        onClose={() => {
          if (!archiveMutation.isPending) setArchiveErrorMsg(null);
        }}
        onCloseClick={() => closeDialog(archiveDialogRef.current)}
      >
        <DialogBody>
          <p className="text-sm leading-6 text-slate-600">{copy.confirmBody}</p>
        </DialogBody>
        <DialogFooter className="items-center justify-end gap-2">
          <button
            className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            data-dialog-initial-focus
            disabled={archiveMutation.isPending}
            type="button"
            onClick={() => closeDialog(archiveDialogRef.current)}
          >
            {copy.cancel}
          </button>
          <button
            className="min-h-9 rounded-md border border-[var(--color-error-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={archiveMutation.isPending}
            type="button"
            onClick={() => archiveMutation.mutate()}
          >
            {copy.confirmArchive}
          </button>
        </DialogFooter>
      </DialogShell>

      <DialogShell
        ref={resetDialogRef}
        closeLabel={copy.close}
        title={copy.resetConfirmTitle}
        titleId="reset-workspace-dialog-title"
        widthClassName="w-[min(36rem,calc(100vw-3rem))]"
        onClose={() => {
          if (!resetMutation.isPending) setResetErrorMsg(null);
        }}
        onCloseClick={() => closeDialog(resetDialogRef.current)}
      >
        <DialogBody className="space-y-4">
          <p className="text-sm leading-6 text-slate-600">{copy.resetConfirmBody}</p>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-700">Select preset</legend>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="reset-preset"
                value="parts-only"
                checked={resetPreset === "parts-only"}
                onChange={() => setResetPreset("parts-only")}
                disabled={resetMutation.isPending}
              />
              {copy.presetPartsOnly}
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="radio"
                name="reset-preset"
                value="parts-and-orders"
                checked={resetPreset === "parts-and-orders"}
                onChange={() => setResetPreset("parts-and-orders")}
                disabled={resetMutation.isPending}
              />
              {copy.presetPartsAndOrders}
            </label>
          </fieldset>
          {resetErrorMsg && (
            <p className="rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-soft)] px-3 py-2 text-sm text-[var(--color-error)]">
              {resetErrorMsg}
            </p>
          )}
        </DialogBody>
        <DialogFooter className="items-center justify-end gap-2">
          <button
            className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            data-dialog-initial-focus
            disabled={resetMutation.isPending}
            type="button"
            onClick={() => closeDialog(resetDialogRef.current)}
          >
            {copy.cancel}
          </button>
          <button
            className="min-h-9 rounded-md border border-[var(--color-error-border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={resetMutation.isPending}
            type="button"
            onClick={() => resetMutation.mutate()}
          >
            {copy.resetButton}
          </button>
        </DialogFooter>
      </DialogShell>
    </div>
  );
}
