"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import type { ConnectedAppsCopy } from "@/app/connected-apps-copy";
import { DateDisplay } from "@/app/date-display";
import { DeleteConfirmationDialog } from "@/app/dialog-shell";
import { disconnectConnectedAppAction } from "@/server/oauth/connectedAppActions";
import type { ConnectedApp } from "@/server/oauth/oauthServer";

type ConnectedAppsClientProps = {
  copy: ConnectedAppsCopy;
  initialApps: ConnectedApp[];
};

function errorMessage(copy: ConnectedAppsCopy, error: string) {
  if (error === "unauthenticated") return copy.errorUnauthenticated;
  if (error === "connected-app-not-found") return copy.errorNotFound;
  return copy.errorGeneric;
}

/** Settings → Connected apps (#322): the user's OAuth-connected apps, each disconnectable. */
export function ConnectedAppsClient({ copy, initialApps }: ConnectedAppsClientProps) {
  const [apps, setApps] = useState(initialApps);
  const [target, setTarget] = useState<ConnectedApp | null>(null);
  const [listError, setListError] = useState<string | null>(null);

  const disconnectMutation = useMutation({
    mutationFn: disconnectConnectedAppAction,
    onSuccess: (result) => {
      setTarget(null);

      if (!result.ok) {
        setListError(errorMessage(copy, result.error));
        return;
      }

      setListError(null);
      setApps(result.data.apps);
    }
  });

  return (
    <div className="space-y-4">
      {listError ? (
        <p className="rounded-md border border-[var(--color-error-border)] bg-[var(--color-error-soft)] px-4 py-3 text-sm text-[var(--color-error)]">
          {listError}
        </p>
      ) : null}

      {apps.length === 0 ? (
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
                <th className="px-3 py-2">{copy.accessColumn}</th>
                <th className="px-3 py-2">{copy.connectedColumn}</th>
                <th className="px-3 py-2">{copy.lastUsedColumn}</th>
                <th className="px-3 py-2">
                  <span className="sr-only">{copy.disconnect}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id} className="border-t border-[var(--color-border)] text-[var(--color-text-secondary)]">
                  <td className="px-3 py-2">
                    <span className="font-medium text-[var(--color-text-primary)]">{app.name}</span>
                    {app.redirectHost ? (
                      <span className="block text-xs text-[var(--color-text-muted)]">{app.redirectHost}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">{app.workspace.name}</td>
                  <td className="px-3 py-2">
                    {app.access === "read-write" ? copy.accessReadWrite : copy.accessReadOnly}
                  </td>
                  <td className="px-3 py-2">
                    <DateDisplay value={app.connectedAt} />
                  </td>
                  <td className="px-3 py-2">
                    {app.lastUsedAt ? <DateDisplay value={app.lastUsedAt} /> : copy.notUsed}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => setTarget(app)}
                      className="rounded-md px-2 py-1 text-sm font-medium text-[var(--color-error)] hover:bg-[var(--color-error-soft)]"
                    >
                      {copy.disconnect}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <DeleteConfirmationDialog
        body={copy.disconnectBody}
        cancelLabel={copy.cancel}
        closeLabel={copy.close}
        confirmLabel={copy.disconnect}
        deleteLabel={copy.disconnectTitle}
        isPending={disconnectMutation.isPending}
        itemName={target ? `"${target.name}"` : ""}
        open={target !== null}
        onCancel={() => setTarget(null)}
        onConfirm={() => {
          if (target) disconnectMutation.mutate(target.id);
        }}
      />
    </div>
  );
}
