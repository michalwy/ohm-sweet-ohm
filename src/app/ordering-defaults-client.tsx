"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { updateWorkspaceOrderingDefaults } from "@/server/workspaces/orderingDefaults";

type Copy = {
  priceEntryMode: string;
  net: string;
  gross: string;
  defaultTaxRate: string;
  defaultTaxRatePlaceholder: string;
  defaultTaxRateHelp: string;
  saveChanges: string;
  saved: string;
  noPermission: string;
  permissionDenied: string;
  databaseUnavailable: string;
  invalidTaxRate: string;
};

type OrderingDefaultsClientProps = {
  canManage: boolean;
  copy: Copy;
  initialPriceEntryMode: "net" | "gross";
  initialTaxRate: string;
  workspaceSlug: string;
};

function getErrorMsg(copy: Copy, error: string) {
  if (error === "workspace-permission-denied") return copy.permissionDenied;
  if (error === "database-unavailable") return copy.databaseUnavailable;
  if (error === "invalid-tax-rate") return copy.invalidTaxRate;
  return copy.invalidTaxRate;
}

export function OrderingDefaultsClient({
  canManage,
  copy,
  initialPriceEntryMode,
  initialTaxRate,
  workspaceSlug
}: OrderingDefaultsClientProps) {
  const [priceEntryMode, setPriceEntryMode] = useState<"net" | "gross">(
    initialPriceEntryMode
  );
  const [taxRate, setTaxRate] = useState(initialTaxRate);
  const [savedOk, setSavedOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateWorkspaceOrderingDefaults,
    onSuccess: (result) => {
      if (!result.ok) {
        setErrorMsg(getErrorMsg(copy, result.error));
        setSavedOk(false);
        return;
      }
      setErrorMsg(null);
      setSavedOk(true);
    }
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavedOk(false);
    setErrorMsg(null);
    mutation.mutate({
      workspaceSlug,
      defaultPriceEntryMode: priceEntryMode,
      defaultTaxRate: taxRate.trim() || null
    });
  }

  const inputClass =
    "min-h-10 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:bg-[var(--color-bg-subtle)] disabled:text-[var(--color-text-placeholder)]";

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
      {!canManage ? (
        <p className="rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {copy.noPermission}
        </p>
      ) : null}

      <div className="grid gap-2">
        <label className="text-sm font-medium text-[var(--color-text-secondary)]">
          {copy.priceEntryMode}
        </label>
        <div className="flex gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input
              type="radio"
              name="priceEntryMode"
              value="net"
              checked={priceEntryMode === "net"}
              onChange={() => setPriceEntryMode("net")}
              disabled={!canManage}
              className="accent-[var(--color-accent)]"
            />
            {copy.net}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]">
            <input
              type="radio"
              name="priceEntryMode"
              value="gross"
              checked={priceEntryMode === "gross"}
              onChange={() => setPriceEntryMode("gross")}
              disabled={!canManage}
              className="accent-[var(--color-accent)]"
            />
            {copy.gross}
          </label>
        </div>
      </div>

      <div className="grid gap-2">
        <label
          className="text-sm font-medium text-[var(--color-text-secondary)]"
          htmlFor="ordering-default-tax-rate"
        >
          {copy.defaultTaxRate}
        </label>
        <input
          id="ordering-default-tax-rate"
          type="text"
          inputMode="decimal"
          placeholder={copy.defaultTaxRatePlaceholder}
          value={taxRate}
          onChange={(e) => setTaxRate(e.target.value)}
          disabled={!canManage}
          className={inputClass}
        />
        <p className="text-xs text-[var(--color-text-muted)]">{copy.defaultTaxRateHelp}</p>
      </div>

      {errorMsg ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMsg}
        </p>
      ) : null}

      {savedOk ? (
        <p className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-700">
          {copy.saved}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canManage || mutation.isPending}
        className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {copy.saveChanges}
      </button>
    </form>
  );
}
