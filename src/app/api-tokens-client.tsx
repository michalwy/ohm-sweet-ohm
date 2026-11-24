"use client";

import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import type { ApiTokensCopy } from "@/app/api-tokens-copy";
import { DateDisplay } from "@/app/date-display";
import {
  DeleteConfirmationDialog,
  DialogActions,
  DialogBody,
  DialogFooter,
  DialogPrimaryButton,
  DialogSecondaryButton,
  DialogShell,
  LabelWithError,
  closeDialog,
  openDialog
} from "@/app/dialog-shell";
import type { PermissionKey } from "@/server/access-control/permissions";
import { createApiTokenAction, revokeApiTokenAction } from "@/server/api-tokens/apiTokenActions";
import type { ApiTokenAccess } from "@/server/api-tokens/apiTokenPermissions";
import type { ApiTokenStatus, ApiTokenSummary } from "@/server/api-tokens/apiTokens";

const EXPIRY_OPTIONS = [null, 7, 30, 90, 365] as const;
type ExpiryOption = (typeof EXPIRY_OPTIONS)[number];

const inputClassName =
  "min-h-10 w-full rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-focus)]";

type ApiTokensClientProps = {
  copy: ApiTokensCopy;
  currentWorkspaceId: string;
  initialTokens: ApiTokenSummary[];
  permissionOptions: Array<{ key: PermissionKey; description: string }>;
  workspaces: Array<{ id: string; name: string }>;
};

function errorMessage(copy: ApiTokensCopy, error: string) {
  switch (error) {
    case "api-token-name-required":
      return copy.errorNameRequired;
    case "api-token-name-too-long":
      return copy.errorNameTooLong;
    case "api-token-permissions-required":
      return copy.errorPermissionsRequired;
    case "api-token-expiry-in-past":
      return copy.errorExpiry;
    case "workspace-not-found":
      return copy.errorWorkspace;
    case "api-token-not-found":
      return copy.errorNotFound;
    case "unauthenticated":
      return copy.errorUnauthenticated;
    default:
      return copy.errorGeneric;
  }
}

function accessLabel(copy: ApiTokensCopy, access: ApiTokenAccess, permissionCount: number) {
  if (access === "read-only") return copy.accessReadOnly;
  if (access === "read-write") return copy.accessReadWrite;
  return `${copy.accessCustom} (${copy.customPermissionCount.replace("{count}", String(permissionCount))})`;
}

function statusLabel(copy: ApiTokensCopy, status: ApiTokenStatus) {
  if (status === "expired") return copy.statusExpired;
  if (status === "workspace-archived") return copy.statusWorkspaceArchived;
  if (status === "no-access") return copy.statusNoAccess;
  return copy.statusActive;
}

export function ApiTokensClient({
  copy,
  currentWorkspaceId,
  initialTokens,
  permissionOptions,
  workspaces
}: ApiTokensClientProps) {
  const [tokens, setTokens] = useState(initialTokens);
  const [revokeTarget, setRevokeTarget] = useState<ApiTokenSummary | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const createDialogRef = useRef<HTMLDialogElement>(null);
  const [createDialogKey, setCreateDialogKey] = useState(0);

  const revokeMutation = useMutation({
    mutationFn: revokeApiTokenAction,
    onSuccess: (result) => {
      setRevokeTarget(null);

      if (!result.ok) {
        setListError(errorMessage(copy, result.error));
        return;
      }

      setListError(null);
      setTokens(result.data.tokens);
    }
  });

  function openCreateDialog() {
    setCreateDialogKey((key) => key + 1);
    window.requestAnimationFrame(() => openDialog(createDialogRef.current));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={openCreateDialog}
          className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95"
        >
          {copy.createToken}
        </button>
      </div>

      {listError ? (
        <p className="rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-soft)] px-4 py-3 text-sm text-[var(--color-error)]">
          {listError}
        </p>
      ) : null}

      {tokens.length === 0 ? (
        <p className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
          {copy.empty}
        </p>
      ) : (
        <div className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)]">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-[var(--color-bg-subtle)] text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              <tr>
                <th className="px-3 py-2">{copy.nameColumn}</th>
                <th className="px-3 py-2">{copy.workspaceColumn}</th>
                <th className="px-3 py-2">{copy.permissionsColumn}</th>
                <th className="px-3 py-2">{copy.createdColumn}</th>
                <th className="px-3 py-2">{copy.expiresColumn}</th>
                <th className="px-3 py-2">{copy.lastUsedColumn}</th>
                <th className="px-3 py-2">{copy.statusColumn}</th>
                <th className="px-3 py-2">
                  <span className="sr-only">{copy.revoke}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((token) => (
                <tr key={token.id} className="border-t border-[var(--color-border)] text-[var(--color-text-secondary)]">
                  <td className="px-3 py-2 font-medium text-[var(--color-text-primary)]">{token.name}</td>
                  <td className="px-3 py-2">{token.workspace.name}</td>
                  <td
                    className="px-3 py-2"
                    title={token.access === "custom" ? token.permissions.join(", ") : undefined}
                  >
                    {accessLabel(copy, token.access, token.permissions.length)}
                  </td>
                  <td className="px-3 py-2">
                    <DateDisplay value={token.createdAt} />
                  </td>
                  <td className="px-3 py-2">
                    {token.expiresAt ? <DateDisplay value={token.expiresAt} /> : copy.never}
                  </td>
                  <td className="px-3 py-2">
                    {token.lastUsedAt ? <DateDisplay value={token.lastUsedAt} /> : copy.notUsed}
                  </td>
                  <td
                    className={`px-3 py-2 ${
                      token.status === "active"
                        ? "text-[var(--color-success)]"
                        : "text-[var(--color-warning)]"
                    }`}
                  >
                    {statusLabel(copy, token.status)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setRevokeTarget(token)}
                      className="rounded-md px-2 py-1 text-sm font-medium text-[var(--color-error)] hover:bg-[var(--color-error-soft)]"
                    >
                      {copy.revoke}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateApiTokenDialog
        key={createDialogKey}
        ref={createDialogRef}
        copy={copy}
        currentWorkspaceId={currentWorkspaceId}
        permissionOptions={permissionOptions}
        workspaces={workspaces}
        onCreated={(nextTokens) => setTokens(nextTokens)}
      />

      <DeleteConfirmationDialog
        body={copy.revokeBody}
        cancelLabel={copy.cancel}
        closeLabel={copy.close}
        confirmLabel={copy.revoke}
        deleteLabel={copy.revokeTitle}
        isPending={revokeMutation.isPending}
        itemName={revokeTarget ? `"${revokeTarget.name}"` : ""}
        open={revokeTarget !== null}
        onCancel={() => setRevokeTarget(null)}
        onConfirm={() => {
          if (revokeTarget) revokeMutation.mutate(revokeTarget.id);
        }}
      />
    </div>
  );
}

type CreateApiTokenDialogProps = {
  ref: React.Ref<HTMLDialogElement>;
  copy: ApiTokensCopy;
  currentWorkspaceId: string;
  permissionOptions: Array<{ key: PermissionKey; description: string }>;
  workspaces: Array<{ id: string; name: string }>;
  onCreated: (tokens: ApiTokenSummary[]) => void;
};

function CreateApiTokenDialog({
  ref,
  copy,
  currentWorkspaceId,
  permissionOptions,
  workspaces,
  onCreated
}: CreateApiTokenDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [name, setName] = useState("");
  const [workspaceId, setWorkspaceId] = useState(
    workspaces.some((w) => w.id === currentWorkspaceId) ? currentWorkspaceId : (workspaces[0]?.id ?? "")
  );
  const [access, setAccess] = useState<ApiTokenAccess>("read-only");
  const [customPermissions, setCustomPermissions] = useState<PermissionKey[]>([]);
  const [expiry, setExpiry] = useState<ExpiryOption>(90);
  const [error, setError] = useState<string | null>(null);
  const [createdValue, setCreatedValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: createApiTokenAction,
    onSuccess: (result) => {
      if (!result.ok) {
        setError(errorMessage(copy, result.error));
        return;
      }

      setError(null);
      setCreatedValue(result.data.value);
      onCreated(result.data.tokens);
    },
    onError: () => setError(copy.errorGeneric)
  });

  function setRefs(element: HTMLDialogElement | null) {
    dialogRef.current = element;
    if (typeof ref === "function") ref(element);
    else if (ref) (ref as React.RefObject<HTMLDialogElement | null>).current = element;
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError(copy.errorNameRequired);
      return;
    }

    if (access === "custom" && customPermissions.length === 0) {
      setError(copy.errorPermissionsRequired);
      return;
    }

    setError(null);
    mutation.mutate({
      name,
      workspaceId,
      access,
      permissions: access === "custom" ? customPermissions : [],
      expiresAt:
        expiry === null ? null : new Date(Date.now() + expiry * 24 * 60 * 60 * 1000).toISOString()
    });
  }

  function togglePermission(key: PermissionKey) {
    setCustomPermissions((current) =>
      current.includes(key) ? current.filter((k) => k !== key) : [...current, key]
    );
  }

  async function copyValue() {
    if (!createdValue) return;

    try {
      await navigator.clipboard.writeText(createdValue);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  if (createdValue) {
    return (
      <DialogShell
        ref={setRefs}
        closeLabel={copy.close}
        title={copy.createdTitle}
        titleId="api-token-created-title"
        widthClassName="w-[min(40rem,calc(100vw-3rem))]"
      >
        <DialogBody className="space-y-3">
          <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{copy.createdBody}</p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={createdValue}
              aria-label={copy.createdTitle}
              className={`${inputClassName} font-mono`}
              onFocus={(event) => event.currentTarget.select()}
            />
            <DialogSecondaryButton onClick={copyValue}>
              {copied ? copy.copied : copy.copy}
            </DialogSecondaryButton>
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogPrimaryButton type="button" onClick={() => closeDialog(dialogRef.current)}>
            {copy.done}
          </DialogPrimaryButton>
        </DialogFooter>
      </DialogShell>
    );
  }

  const accessOptions: Array<{ value: ApiTokenAccess; label: string; help: string }> = [
    { value: "read-only", label: copy.accessReadOnly, help: copy.accessReadOnlyHelp },
    { value: "read-write", label: copy.accessReadWrite, help: copy.accessReadWriteHelp },
    { value: "custom", label: copy.accessCustom, help: copy.accessCustomHelp }
  ];

  return (
    <DialogShell
      ref={setRefs}
      closeLabel={copy.close}
      description={copy.dialogDescription}
      title={copy.dialogTitle}
      titleId="api-token-create-title"
      widthClassName="w-[min(40rem,calc(100vw-3rem))]"
    >
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-col">
        <DialogBody className="space-y-4">
          <div className="grid gap-1.5">
            <LabelWithError htmlFor="api-token-name">{copy.nameLabel}</LabelWithError>
            <input
              id="api-token-name"
              value={name}
              maxLength={100}
              placeholder={copy.namePlaceholder}
              onChange={(event) => setName(event.target.value)}
              className={inputClassName}
            />
          </div>

          <div className="grid gap-1.5">
            <LabelWithError htmlFor="api-token-workspace">{copy.workspaceLabel}</LabelWithError>
            <select
              id="api-token-workspace"
              value={workspaceId}
              onChange={(event) => setWorkspaceId(event.target.value)}
              className={inputClassName}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))}
            </select>
          </div>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium text-[var(--color-text-secondary)]">
              {copy.accessLabel}
            </legend>
            {accessOptions.map((option) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-2 text-sm text-[var(--color-text-secondary)]"
              >
                <input
                  type="radio"
                  name="api-token-access"
                  value={option.value}
                  checked={access === option.value}
                  onChange={() => setAccess(option.value)}
                  className="mt-1 accent-[var(--color-accent)]"
                />
                <span>
                  <span className="font-medium text-[var(--color-text-primary)]">{option.label}</span>
                  <span className="ml-1.5 text-[var(--color-text-muted)]">— {option.help}</span>
                </span>
              </label>
            ))}
            {access === "custom" ? (
              <div className="ml-6 grid max-h-56 grid-cols-2 gap-x-4 gap-y-1 overflow-auto rounded-md border border-[var(--color-border)] p-3">
                {permissionOptions.map((option) => (
                  <label
                    key={option.key}
                    title={option.description}
                    className="flex cursor-pointer items-center gap-2 font-mono text-xs text-[var(--color-text-secondary)]"
                  >
                    <input
                      type="checkbox"
                      checked={customPermissions.includes(option.key)}
                      onChange={() => togglePermission(option.key)}
                      className="accent-[var(--color-accent)]"
                    />
                    {option.key}
                  </label>
                ))}
              </div>
            ) : null}
          </fieldset>

          <div className="grid gap-1.5">
            <LabelWithError htmlFor="api-token-expiry">{copy.expiryLabel}</LabelWithError>
            <select
              id="api-token-expiry"
              value={expiry === null ? "never" : String(expiry)}
              onChange={(event) =>
                setExpiry(event.target.value === "never" ? null : (Number(event.target.value) as ExpiryOption))
              }
              className={inputClassName}
            >
              {EXPIRY_OPTIONS.map((days) => (
                <option key={days ?? "never"} value={days === null ? "never" : String(days)}>
                  {days === null ? copy.expiryNever : copy.expiryDays.replace("{days}", String(days))}
                </option>
              ))}
            </select>
          </div>
        </DialogBody>
        <DialogActions
          cancelLabel={copy.cancel}
          actionLabel={copy.create}
          disabled={mutation.isPending || !workspaceId}
          error={error}
        />
      </form>
    </DialogShell>
  );
}
