"use client";

import { type FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { updateDigiKeyIntegrationSettings } from "@/server/integrations/digikeyActions";

type Copy = {
  sectionTitle: string;
  sectionBody: string;
  clientId: string;
  clientSecret: string;
  saveChanges: string;
  saved: string;
  noPermission: string;
  missingRequiredFields: string;
  permissionDenied: string;
  databaseUnavailable: string;
};

export function DigiKeyIntegrationSettingsClient({
  canManageIntegrations,
  copy,
  hasSavedClientSecret,
  initialClientId,
  isDatabaseAvailable,
  workspaceSlug
}: {
  canManageIntegrations: boolean;
  copy: Copy;
  hasSavedClientSecret: boolean;
  initialClientId: string;
  isDatabaseAvailable: boolean;
  workspaceSlug: string;
}) {
  const [clientId, setClientId] = useState(initialClientId);
  const [clientSecret, setClientSecret] = useState("");
  const [formMessage, setFormMessage] = useState("");

  const updateMutation = useMutation({
    mutationFn: updateDigiKeyIntegrationSettings,
    onSuccess: (result) => {
      if (!result.ok) {
        if (result.error === "missing-required-fields") {
          setFormMessage(copy.missingRequiredFields);
          return;
        }

        if (result.error === "workspace_permission_denied") {
          setFormMessage(copy.permissionDenied);
          return;
        }

        setFormMessage(copy.databaseUnavailable);
        return;
      }

      setClientSecret("");
      setFormMessage(copy.saved);
    },
    onError: () => {
      setFormMessage(copy.databaseUnavailable);
    }
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const formData = new FormData();
    formData.set("workspaceSlug", workspaceSlug);
    formData.set("clientId", clientId);
    formData.set("clientSecret", clientSecret);

    setFormMessage("");
    updateMutation.mutate(formData);
  }

  const disabled =
    !isDatabaseAvailable || !canManageIntegrations || updateMutation.isPending;

  return (
    <section className="max-w-3xl rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-950">{copy.sectionTitle}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">{copy.sectionBody}</p>

      {!canManageIntegrations ? (
        <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {copy.noPermission}
        </p>
      ) : null}

      <form className="mt-4 grid gap-3" onSubmit={handleSubmit}>
        <label className="grid gap-1 text-sm font-medium text-slate-700" htmlFor="digikey-client-id">
          {copy.clientId}
          <input
            id="digikey-client-id"
            className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            type="text"
            value={clientId}
            disabled={disabled}
            onChange={(event) => setClientId(event.currentTarget.value)}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700" htmlFor="digikey-client-secret">
          {copy.clientSecret}
          <input
            id="digikey-client-secret"
            className="min-h-10 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
            type="password"
            value={clientSecret}
            placeholder={hasSavedClientSecret ? "Enter new secret to replace existing one" : "Enter client secret"}
            disabled={disabled}
            onChange={(event) => setClientSecret(event.currentTarget.value)}
          />
        </label>
        <div className="flex items-center gap-3">
          <button
            className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 py-2 text-sm font-medium text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={disabled}
          >
            {copy.saveChanges}
          </button>
          {formMessage ? <p className="text-sm text-slate-600">{formMessage}</p> : null}
        </div>
      </form>
    </section>
  );
}
