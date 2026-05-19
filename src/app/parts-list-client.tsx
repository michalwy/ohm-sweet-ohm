"use client";

import { useEffect, useRef } from "react";

import { createPart, updatePart } from "@/server/parts/createPart";
import type { PartsListItem } from "@/server/parts/getParts";

type Copy = {
  title: string;
  catalogNumber: string;
  manufacturer: string;
  newPartTitle: string;
  newPartBody: string;
  catalogNumberPlaceholder: string;
  manufacturerPlaceholder: string;
  createPart: string;
  close: string;
  addPart: string;
  created: string;
  updated: string;
  missingRequiredFields: string;
  unsupportedField: string;
  emptyTitle: string;
  emptyBody: string;
  databaseUnavailable: string;
};

type PartsListClientProps = {
  copy: Copy;
  isDatabaseAvailable: boolean;
  partCreated: boolean;
  partDialogOpen: boolean;
  partFormError?: string;
  partUpdated: boolean;
  partUpdateError?: string;
  parts: PartsListItem[];
};

export function PartsListClient({
  copy,
  isDatabaseAvailable,
  partCreated,
  partDialogOpen,
  partFormError,
  partUpdated,
  partUpdateError,
  parts
}: PartsListClientProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (partDialogOpen) {
      openDialog(dialogRef.current);
    }
  }, [partDialogOpen]);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {partCreated ? (
            <p className="border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
              {copy.created}
            </p>
          ) : null}
          {partUpdated ? (
            <p className="border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100">
              {copy.updated}
            </p>
          ) : null}
          {partUpdateError ? (
            <p className="border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
              {getUpdateErrorMessage(copy, partUpdateError)}
            </p>
          ) : null}
        </div>
        <button
          className="min-h-11 border border-cyan-300 bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
          disabled={!isDatabaseAvailable}
          type="button"
          onClick={() => openDialog(dialogRef.current)}
        >
          {copy.addPart}
        </button>
      </div>

      <section aria-labelledby="parts-heading">
        <h2 id="parts-heading" className="sr-only">
          {copy.title}
        </h2>
        <div className="overflow-hidden border border-zinc-800">
          <table className="min-w-full divide-y divide-zinc-800 text-left text-sm">
            <thead className="bg-zinc-900">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium text-zinc-300">
                  {copy.catalogNumber}
                </th>
                <th scope="col" className="px-4 py-3 font-medium text-zinc-300">
                  {copy.manufacturer}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900 bg-zinc-950">
              {parts.length > 0 ? (
                parts.map((part) => (
                  <tr key={part.id}>
                    <InlinePartCell
                      field="catalogNumber"
                      label={copy.catalogNumber}
                      partId={part.id}
                      value={part.catalogNumber}
                      valueClassName="font-mono"
                      disabled={!isDatabaseAvailable}
                    />
                    <InlinePartCell
                      field="manufacturerName"
                      label={copy.manufacturer}
                      partId={part.id}
                      value={part.manufacturerName}
                      disabled={!isDatabaseAvailable}
                    />
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-10" colSpan={2}>
                    <p className="text-base font-medium text-zinc-100">
                      {copy.emptyTitle}
                    </p>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
                      {copy.emptyBody}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <dialog
        ref={dialogRef}
        aria-labelledby="add-part-dialog-title"
        className="w-[calc(100%-2rem)] max-w-2xl border border-zinc-700 bg-zinc-950 p-0 text-zinc-100 shadow-2xl backdrop:bg-zinc-950/80"
      >
        <div className="p-4 sm:p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2
                id="add-part-dialog-title"
                className="text-lg font-semibold text-zinc-100"
              >
                {copy.newPartTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 text-zinc-400">
                {copy.newPartBody}
              </p>
            </div>
            <form method="dialog">
              <button
                className="min-h-9 border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-900"
                type="submit"
              >
                {copy.close}
              </button>
            </form>
          </div>

          {partFormError ? (
            <p className="mb-4 border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-sm text-rose-100">
              {partFormError === "missing-required-fields"
                ? copy.missingRequiredFields
                : copy.databaseUnavailable}
            </p>
          ) : null}

          <form action={createPart} className="grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-zinc-300">
              {copy.catalogNumber}
              <input
                className="min-h-11 border border-zinc-700 bg-zinc-900 px-3 py-2 font-mono text-base text-zinc-100 outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                name="catalogNumber"
                placeholder={copy.catalogNumberPlaceholder}
                required
                type="text"
                disabled={!isDatabaseAvailable}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-zinc-300">
              {copy.manufacturer}
              <input
                className="min-h-11 border border-zinc-700 bg-zinc-900 px-3 py-2 text-base text-zinc-100 outline-none transition focus:border-cyan-300 disabled:cursor-not-allowed disabled:opacity-60"
                name="manufacturerName"
                placeholder={copy.manufacturerPlaceholder}
                required
                type="text"
                disabled={!isDatabaseAvailable}
              />
            </label>
            <div className="flex justify-end">
              <button
                className="min-h-11 border border-cyan-300 bg-cyan-300 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:border-zinc-700 disabled:bg-zinc-800 disabled:text-zinc-500"
                type="submit"
                disabled={!isDatabaseAvailable}
              >
                {copy.createPart}
              </button>
            </div>
          </form>
        </div>
      </dialog>
    </>
  );
}

function openDialog(dialog: HTMLDialogElement | null) {
  if (!dialog || dialog.open) {
    return;
  }

  try {
    dialog.showModal();
  } catch {
    dialog.setAttribute("open", "");
  }
}

type InlinePartCellProps = {
  disabled: boolean;
  field: "catalogNumber" | "manufacturerName";
  label: string;
  partId: string;
  value: string;
  valueClassName?: string;
};

function InlinePartCell({
  disabled,
  field,
  label,
  partId,
  value,
  valueClassName
}: InlinePartCellProps) {
  const formRef = useRef<HTMLFormElement>(null);

  function submitIfChanged(nextValue: string) {
    if (nextValue.trim() !== value) {
      formRef.current?.requestSubmit();
    }
  }

  return (
    <td className="px-4 py-3">
      <form ref={formRef} action={updatePart}>
        <input name="id" type="hidden" value={partId} />
        <input name="field" type="hidden" value={field} />
        <label className="sr-only" htmlFor={`${field}-${partId}`}>
          {label}
        </label>
        <input
          id={`${field}-${partId}`}
          aria-label={label}
          className={`min-h-10 w-full border border-transparent bg-transparent px-2 py-1.5 text-zinc-100 outline-none transition hover:border-zinc-800 hover:bg-zinc-900 focus:border-cyan-300 focus:bg-zinc-900 disabled:cursor-not-allowed disabled:text-zinc-500 ${valueClassName ?? ""}`}
          defaultValue={value}
          disabled={disabled}
          name="value"
          required
          type="text"
          onBlur={(event) => submitIfChanged(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitIfChanged(event.currentTarget.value);
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              event.currentTarget.value = value;
              event.currentTarget.blur();
            }
          }}
        />
      </form>
    </td>
  );
}

function getUpdateErrorMessage(copy: Copy, error: string) {
  if (error === "missing-required-fields") {
    return copy.missingRequiredFields;
  }

  if (error === "unsupported-field") {
    return copy.unsupportedField;
  }

  return copy.databaseUnavailable;
}
