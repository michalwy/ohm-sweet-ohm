"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  createShoppingListForWorkspace,
  getAllShoppingListsForWorkspace
} from "@/server/shopping-lists/shoppingListActions";

export type ShoppingListTargetMode = "existing" | "create-new";

export type ShoppingListTargetCopy = {
  chooseSL: string;
  createNewSL: string;
  slName: string;
  slNamePlaceholder: string;
  loadingLabel: string;
};

export type ShoppingListTargetState = {
  isLoading: boolean;
  mode: ShoppingListTargetMode;
  setMode: (mode: ShoppingListTargetMode) => void;
  allSLs: Array<{ id: string; name: string; itemCount: number }>;
  selectedSLId: string;
  setSelectedSLId: (id: string) => void;
  newSLName: string;
  setNewSLName: (name: string) => void;
  /** Resolves to the target shopping list id, creating one first when `mode === "create-new"`. */
  resolveListId: () => Promise<{ ok: true; listId: string } | { ok: false; error: string }>;
};

export function useShoppingListTarget({
  workspaceSlug,
  open
}: {
  workspaceSlug: string;
  open: boolean;
}): ShoppingListTargetState {
  const [mode, setMode] = useState<ShoppingListTargetMode>("existing");
  const [selectedSLId, setSelectedSLId] = useState("");
  const [newSLName, setNewSLName] = useState("");

  const allSLsQuery = useQuery({
    queryKey: ["all-sls", workspaceSlug],
    enabled: open,
    queryFn: async () => {
      const result = await getAllShoppingListsForWorkspace({ workspaceSlug });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    }
  });

  const allSLs = allSLsQuery.data ?? [];

  useEffect(() => {
    if (allSLs.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMode("create-new");
    } else {
      setMode("existing");
      if (!selectedSLId || !allSLs.find((sl) => sl.id === selectedSLId)) {
        setSelectedSLId(allSLs[0]?.id ?? "");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- selectedSLId intentionally omitted: effect only syncs mode/selection when the SL list changes, not on every selection change
  }, [allSLs, allSLs.length]);

  async function resolveListId(): Promise<
    { ok: true; listId: string } | { ok: false; error: string }
  > {
    if (mode === "create-new") {
      const createResult = await createShoppingListForWorkspace({
        workspaceSlug,
        name: newSLName.trim()
      });
      if (!createResult.ok) return { ok: false, error: createResult.error };
      return { ok: true, listId: createResult.data.listId };
    }
    return { ok: true, listId: selectedSLId };
  }

  return {
    isLoading: allSLsQuery.isLoading,
    mode,
    setMode,
    allSLs,
    selectedSLId,
    setSelectedSLId,
    newSLName,
    setNewSLName,
    resolveListId
  };
}

export function ShoppingListTargetFields({
  state,
  copy,
  slNameError
}: {
  state: ShoppingListTargetState;
  copy: ShoppingListTargetCopy;
  slNameError?: string;
}) {
  const { mode, setMode, allSLs, selectedSLId, setSelectedSLId, newSLName, setNewSLName } = state;

  return (
    <>
      {allSLs.length > 0 && mode === "existing" ? (
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-[var(--color-text-secondary)]">{copy.chooseSL}</span>
          <select
            className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none"
            value={selectedSLId}
            onChange={(e) => setSelectedSLId(e.currentTarget.value)}
          >
            {allSLs.map((sl) => (
              <option key={sl.id} value={sl.id}>
                {sl.name}
                {sl.itemCount > 0 ? ` (${sl.itemCount})` : ""}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {mode === "create-new" ? (
        <section className="grid gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] p-3">
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">{copy.createNewSL}</p>
          <label className="grid gap-1 text-sm">
            <span className="font-medium text-[var(--color-text-secondary)]">{copy.slName}</span>
            <input
              className="min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none"
              placeholder={copy.slNamePlaceholder}
              value={newSLName}
              onChange={(e) => setNewSLName(e.currentTarget.value)}
            />
            {slNameError ? <p className="text-xs text-[var(--color-error)]">{slNameError}</p> : null}
          </label>
        </section>
      ) : null}

      {allSLs.length > 0 ? (
        <div>
          <button
            className="text-sm text-[var(--color-accent)] hover:underline"
            type="button"
            onClick={() => setMode(mode === "existing" ? "create-new" : "existing")}
          >
            {mode === "existing" ? copy.createNewSL : copy.chooseSL}
          </button>
        </div>
      ) : null}
    </>
  );
}
