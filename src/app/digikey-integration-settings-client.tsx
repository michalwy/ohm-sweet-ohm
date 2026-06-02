"use client";

import { type FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  updateActiveSupplierProviderSettings,
  updateDigiKeyIntegrationSettings,
  updateTmeIntegrationSettings
} from "@/server/integrations/settingsActions";
import type { SupplierProviderKey } from "@/server/integrations/types";

type Copy = {
  sectionTitle: string;
  sectionBody: string;
  providerSectionTitle: string;
  providerSectionBody: string;
  digikey: string;
  tme: string;
  clientId: string;
  clientSecret: string;
  tmeApiToken: string;
  tmeApplicationSecret: string;
  saveChanges: string;
  setActiveProvider: string;
  saved: string;
  noPermission: string;
  missingRequiredFields: string;
  invalidProvider: string;
  permissionDenied: string;
  databaseUnavailable: string;
};

export function DigiKeyIntegrationSettingsClient({
  canManageIntegrations,
  copy,
  hasSavedDigiKeyClientSecret,
  hasSavedTmeClientSecret,
  initialActiveProvider,
  initialDigiKeyClientId,
  initialTmeClientId,
  isDatabaseAvailable,
  workspaceSlug
}: {
  canManageIntegrations: boolean;
  copy: Copy;
  hasSavedDigiKeyClientSecret: boolean;
  hasSavedTmeClientSecret: boolean;
  initialActiveProvider: SupplierProviderKey | null;
  initialDigiKeyClientId: string;
  initialTmeClientId: string;
  isDatabaseAvailable: boolean;
  workspaceSlug: string;
}) {
  const [digiKeyClientId, setDigiKeyClientId] = useState(initialDigiKeyClientId);
  const [digiKeyClientSecret, setDigiKeyClientSecret] = useState("");
  const [tmeClientId, setTmeClientId] = useState(initialTmeClientId);
  const [tmeClientSecret, setTmeClientSecret] = useState("");
  const [activeProvider, setActiveProvider] = useState<SupplierProviderKey>(
    initialActiveProvider ?? "digikey"
  );
  const [formMessage, setFormMessage] = useState("");

  const digiKeyMutation = useMutation({
    mutationFn: updateDigiKeyIntegrationSettings,
    onSuccess: (result) => {
      handleResult(result);
      if (result.ok) {
        setDigiKeyClientSecret("");
      }
    },
    onError: () => {
      setFormMessage(copy.databaseUnavailable);
    }
  });

  const tmeMutation = useMutation({
    mutationFn: updateTmeIntegrationSettings,
    onSuccess: (result) => {
      handleResult(result);
      if (result.ok) {
        setTmeClientSecret("");
      }
    },
    onError: () => {
      setFormMessage(copy.databaseUnavailable);
    }
  });

  const activeProviderMutation = useMutation({
    mutationFn: updateActiveSupplierProviderSettings,
    onSuccess: handleResult,
    onError: () => {
      setFormMessage(copy.databaseUnavailable);
    }
  });

  function handleResult(
    result:
      | { ok: true }
      | {
          ok: false;
          error:
            | "missing-required-fields"
            | "invalid-provider"
            | "workspace-permission-denied"
            | "database-unavailable";
        }
  ) {
    if (!result.ok) {
      if (result.error === "missing-required-fields") {
        setFormMessage(copy.missingRequiredFields);
        return;
      }

      if (result.error === "invalid-provider") {
        setFormMessage(copy.invalidProvider);
        return;
      }

      if (result.error === "workspace-permission-denied") {
        setFormMessage(copy.permissionDenied);
        return;
      }

      setFormMessage(copy.databaseUnavailable);
      return;
    }

    setFormMessage(copy.saved);
  }

  function handleSaveDigiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData();
    formData.set("workspaceSlug", workspaceSlug);
    formData.set("clientId", digiKeyClientId);
    formData.set("clientSecret", digiKeyClientSecret);

    setFormMessage("");
    digiKeyMutation.mutate(formData);
  }

  function handleSaveTme(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData();
    formData.set("workspaceSlug", workspaceSlug);
    formData.set("clientId", tmeClientId);
    formData.set("clientSecret", tmeClientSecret);

    setFormMessage("");
    tmeMutation.mutate(formData);
  }

  function handleSaveActiveProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData();
    formData.set("workspaceSlug", workspaceSlug);
    formData.set("provider", activeProvider);

    setFormMessage("");
    activeProviderMutation.mutate(formData);
  }

  const disabled = !isDatabaseAvailable || !canManageIntegrations;

  return (
    <section className="max-w-3xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{copy.sectionTitle}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">{copy.sectionBody}</p>

      {!canManageIntegrations ? (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {copy.noPermission}
        </p>
      ) : null}

      <form className="mt-4 grid gap-3 rounded-md border border-slate-200 p-4" onSubmit={handleSaveActiveProvider}>
        <h3 className="text-sm font-semibold text-slate-900">{copy.providerSectionTitle}</h3>
        <p className="text-sm text-slate-600">{copy.providerSectionBody}</p>
        <fieldset className="grid gap-2" disabled={disabled || activeProviderMutation.isPending}>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="active-provider"
              value="digikey"
              checked={activeProvider === "digikey"}
              onChange={() => setActiveProvider("digikey")}
            />
            {copy.digikey}
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="radio"
              name="active-provider"
              value="tme"
              checked={activeProvider === "tme"}
              onChange={() => setActiveProvider("tme")}
            />
            {copy.tme}
          </label>
        </fieldset>
        <div className="flex items-center gap-3">
          <button
            className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={disabled || activeProviderMutation.isPending}
          >
            {copy.setActiveProvider}
          </button>
        </div>
      </form>

      <form className="mt-4 grid gap-3 rounded-md border border-slate-200 p-4" onSubmit={handleSaveDigiKey}>
        <h3 className="text-sm font-semibold text-slate-900">{copy.digikey}</h3>
        <label className="grid gap-1 text-sm font-medium text-slate-700" htmlFor="digikey-client-id">
          {copy.clientId}
          <input
            id="digikey-client-id"
            className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            type="text"
            value={digiKeyClientId}
            disabled={disabled || digiKeyMutation.isPending}
            onChange={(event) => setDigiKeyClientId(event.currentTarget.value)}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700" htmlFor="digikey-client-secret">
          {copy.clientSecret}
          <input
            id="digikey-client-secret"
            className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            type="password"
            value={digiKeyClientSecret}
            placeholder={
              hasSavedDigiKeyClientSecret
                ? "Enter new secret to replace existing one"
                : "Enter client secret"
            }
            disabled={disabled || digiKeyMutation.isPending}
            onChange={(event) => setDigiKeyClientSecret(event.currentTarget.value)}
          />
        </label>
        <button
          className="min-h-10 w-fit rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={disabled || digiKeyMutation.isPending}
        >
          {copy.saveChanges}
        </button>
      </form>

      <form className="mt-4 grid gap-3 rounded-md border border-slate-200 p-4" onSubmit={handleSaveTme}>
        <h3 className="text-sm font-semibold text-slate-900">{copy.tme}</h3>
        <label className="grid gap-1 text-sm font-medium text-slate-700" htmlFor="tme-client-id">
          {copy.tmeApiToken}
          <input
            id="tme-client-id"
            className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            type="text"
            value={tmeClientId}
            disabled={disabled || tmeMutation.isPending}
            onChange={(event) => setTmeClientId(event.currentTarget.value)}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700" htmlFor="tme-client-secret">
          {copy.tmeApplicationSecret}
          <input
            id="tme-client-secret"
            className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            type="password"
            value={tmeClientSecret}
            placeholder={
              hasSavedTmeClientSecret
                ? "Enter new secret to replace existing one"
                : "Enter application secret"
            }
            disabled={disabled || tmeMutation.isPending}
            onChange={(event) => setTmeClientSecret(event.currentTarget.value)}
          />
        </label>
        <button
          className="min-h-10 w-fit rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          disabled={disabled || tmeMutation.isPending}
        >
          {copy.saveChanges}
        </button>
      </form>

      {formMessage ? <p className="mt-4 text-sm text-slate-600">{formMessage}</p> : null}
    </section>
  );
}
