"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";

import { adminCopy as copy } from "@/app/admin/admin-copy";
import { DialogActions, DialogBody, DialogShell, closeDialog, openDialog } from "@/app/dialog-shell";
import { deleteUserAction, deleteUserDataAction } from "@/server/admin/adminActions";

type Mode = "data" | "user";

const destructiveButtonClass =
  "inline-flex min-h-9 items-center justify-center rounded-md border border-[var(--color-error-border)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm font-medium text-[var(--color-error)] transition hover:bg-[var(--color-error-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--color-error-border)] focus:ring-offset-2";

/** Delete a user's data, or the user, each behind a typed confirmation (#324). */
export function AdminUserActions({
  userId,
  email,
  solelyOwnedCount
}: {
  userId: string;
  email: string;
  solelyOwnedCount: number;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mode, setMode] = useState<Mode>("data");
  const [confirmInput, setConfirmInput] = useState("");
  const [deleteData, setDeleteData] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => (mode === "data" ? deleteUserDataAction(userId) : deleteUserAction(userId, deleteData)),
    onSuccess: (result) => {
      if (!result.ok) {
        setErrorMsg(copy.errors[result.error] ?? copy.errors.unavailable);
        return;
      }

      closeDialog(dialogRef.current);

      if (result.data.userDeleted) {
        router.push("/admin");
      }

      router.refresh();
    }
  });

  function open(nextMode: Mode) {
    setMode(nextMode);
    setConfirmInput("");
    setDeleteData(false);
    setErrorMsg(null);
    openDialog(dialogRef.current);
  }

  function close() {
    if (!mutation.isPending) {
      closeDialog(dialogRef.current);
    }
  }

  const canConfirm = confirmInput.trim() === email && !mutation.isPending;

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button className={destructiveButtonClass} type="button" onClick={() => open("data")}>
        {copy.deleteData}
      </button>
      <button className={destructiveButtonClass} type="button" onClick={() => open("user")}>
        {copy.deleteUser}
      </button>

      <DialogShell
        ref={dialogRef}
        closeLabel={copy.close}
        title={mode === "data" ? copy.deleteDataTitle : copy.deleteUserTitle}
        titleId="admin-delete-user-dialog-title"
        widthClassName="w-[min(34rem,calc(100vw-3rem))]"
        onCloseClick={close}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (canConfirm) mutation.mutate();
          }}
        >
          <DialogBody>
            <p className="text-sm leading-6 text-[var(--color-text-secondary)]">
              {mode === "data" ? copy.deleteDataBody(solelyOwnedCount) : copy.deleteUserBody}
            </p>
            {mode === "user" && solelyOwnedCount > 0 ? (
              <label className="mt-3 flex items-start gap-2 text-sm text-[var(--color-text-secondary)]">
                <input
                  checked={deleteData}
                  className="mt-1 accent-[var(--color-error)]"
                  disabled={mutation.isPending}
                  type="checkbox"
                  onChange={(event) => setDeleteData(event.target.checked)}
                />
                {copy.deleteUserWithData} ({solelyOwnedCount})
              </label>
            ) : null}
            <div className="mt-4 grid gap-1.5">
              <label className="text-sm font-medium text-[var(--color-text-secondary)]" htmlFor="admin-delete-confirm-input">
                {copy.confirmInstruction}
              </label>
              <input
                autoComplete="off"
                className="min-h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-placeholder)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
                data-dialog-initial-focus
                disabled={mutation.isPending}
                id="admin-delete-confirm-input"
                placeholder={copy.confirmPlaceholder}
                type="text"
                value={confirmInput}
                onChange={(event) => setConfirmInput(event.target.value)}
              />
            </div>
            {errorMsg ? (
              <p className="mt-3 rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-soft)] px-3 py-2 text-sm text-[var(--color-error)]">
                {errorMsg}
              </p>
            ) : null}
          </DialogBody>
          <DialogActions actionLabel={copy.delete} variant="destructive" disabled={!canConfirm} />
        </form>
      </DialogShell>
    </div>
  );
}
