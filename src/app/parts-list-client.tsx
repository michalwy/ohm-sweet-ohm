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
  const hasFeedback = partCreated || partUpdated || partUpdateError;

  useEffect(() => {
    if (partDialogOpen) {
      openDialog(dialogRef.current);
    }
  }, [partDialogOpen]);

  return (
    <>
      <section
        aria-labelledby="parts-heading"
        className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
      >
        <h2 id="parts-heading" className="sr-only">
          {copy.title}
        </h2>
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-10">
            {hasFeedback ? (
              <>
                {partCreated ? (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                    {copy.created}
                  </p>
                ) : null}
                {partUpdated ? (
                  <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800">
                    {copy.updated}
                  </p>
                ) : null}
                {partUpdateError ? (
                  <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-800">
                    {getUpdateErrorMessage(copy, partUpdateError)}
                  </p>
                ) : null}
              </>
            ) : null}
          </div>
          <button
            className="min-h-10 rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
            disabled={!isDatabaseAvailable}
            type="button"
            onClick={() => openDialog(dialogRef.current)}
          >
            {copy.addPart}
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th
                  scope="col"
                  className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-600"
                >
                  {copy.catalogNumber}
                </th>
                <th
                  scope="col"
                  className="border-b border-slate-200 px-4 py-3 font-semibold text-slate-600"
                >
                  {copy.manufacturer}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {parts.length > 0 ? (
                parts.map((part) => (
                  <tr
                    key={part.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50"
                  >
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
                    <p className="text-base font-medium text-slate-950">
                      {copy.emptyTitle}
                    </p>
                    <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
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
        className="fixed inset-0 m-auto max-h-[calc(100vh-2rem)] w-[calc(100%-2rem)] max-w-2xl rounded-lg border border-slate-200 bg-white p-0 text-slate-950 shadow-2xl backdrop:bg-slate-950/40"
      >
        <div className="p-4 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-200 pb-5">
            <div>
              <h2
                id="add-part-dialog-title"
                className="text-lg font-semibold text-slate-950"
              >
                {copy.newPartTitle}
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {copy.newPartBody}
              </p>
            </div>
            <form method="dialog">
              <button
                className="min-h-9 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2"
                type="submit"
              >
                {copy.close}
              </button>
            </form>
          </div>

          {partFormError ? (
            <p className="mb-4 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
              {partFormError === "missing-required-fields"
                ? copy.missingRequiredFields
                : copy.databaseUnavailable}
            </p>
          ) : null}

          <form action={createPart} className="grid gap-4">
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              {copy.catalogNumber}
              <input
                className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                name="catalogNumber"
                placeholder={copy.catalogNumberPlaceholder}
                required
                type="text"
                disabled={!isDatabaseAvailable}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium text-slate-700">
              {copy.manufacturer}
              <input
                className="min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                name="manufacturerName"
                placeholder={copy.manufacturerPlaceholder}
                required
                type="text"
                disabled={!isDatabaseAvailable}
              />
            </label>
            <div className="flex justify-end">
              <button
                className="min-h-11 rounded-md border border-slate-950 bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
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
    <td className="border-b border-slate-100 px-4 py-2">
      <form ref={formRef} action={updatePart}>
        <input name="id" type="hidden" value={partId} />
        <input name="field" type="hidden" value={field} />
        <label className="sr-only" htmlFor={`${field}-${partId}`}>
          {label}
        </label>
        <input
          id={`${field}-${partId}`}
          aria-label={label}
          className={`min-h-9 w-full rounded-md border border-transparent bg-transparent px-2 py-1.5 text-slate-950 outline-none transition hover:border-slate-200 hover:bg-white focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:text-slate-400 ${valueClassName ?? ""}`}
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
