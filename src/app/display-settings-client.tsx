"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { updateUserDisplayPreferences } from "@/server/user/displayPreferences";
import { formatDate, formatTime } from "@/app/date-display";

const PREVIEW_DATE = new Date(2025, 6, 9, 15, 30); // 2025-07-09 15:30

const DATE_PRESETS = [
  { value: "locale", label: "Browser default" },
  { value: "abbr", label: "Jul 9, 2026" },
  { value: "YMD", label: "YYYY-MM-DD" },
  { value: "DMY", label: "DD/MM/YYYY" },
  { value: "MDY", label: "MM/DD/YYYY" }
] as const;

const TIME_PRESETS = [
  { value: "locale", label: "Browser default" },
  { value: "12h", label: "12-hour" },
  { value: "24h", label: "24-hour" }
] as const;

type Copy = {
  dateFormat: string;
  timeFormat: string;
  relativeFormat: string;
  relativeFormatHelp: string;
  preview: string;
  saveChanges: string;
  saved: string;
  errorGeneric: string;
  errorUnauthenticated: string;
};

type DisplaySettingsClientProps = {
  copy: Copy;
  initialDateFormat: string;
  initialTimeFormat: string;
  initialRelativeFormat: boolean;
};

function getErrorMsg(copy: Copy, error: string) {
  if (error === "unauthenticated") return copy.errorUnauthenticated;
  return copy.errorGeneric;
}

export function DisplaySettingsClient({
  copy,
  initialDateFormat,
  initialTimeFormat,
  initialRelativeFormat
}: DisplaySettingsClientProps) {
  const [dateFormat, setDateFormat] = useState(initialDateFormat);
  const [timeFormat, setTimeFormat] = useState(initialTimeFormat);
  const [relativeFormat, setRelativeFormat] = useState(initialRelativeFormat);
  const [savedOk, setSavedOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: updateUserDisplayPreferences,
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
    mutation.mutate({ dateFormat, timeFormat, relativeFormat });
  }

  function markDirty() {
    setSavedOk(false);
  }

  const previewDate = formatDate(PREVIEW_DATE, dateFormat);
  const previewTime = formatTime(PREVIEW_DATE, timeFormat);

  return (
    <form onSubmit={handleSubmit} className="max-w-lg space-y-6">
      <div className="grid gap-2">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          {copy.dateFormat}
        </p>
        <div className="flex flex-col gap-2">
          {DATE_PRESETS.map((preset) => (
            <label
              key={preset.value}
              className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]"
            >
              <input
                type="radio"
                name="dateFormat"
                value={preset.value}
                checked={dateFormat === preset.value}
                onChange={() => { setDateFormat(preset.value); markDirty(); }}
                className="accent-[var(--color-accent)]"
              />
              <span>
                {preset.label}
                {preset.value !== "locale" && (
                  <span className="ml-1.5 text-[var(--color-text-muted)]">
                    — {formatDate(PREVIEW_DATE, preset.value)}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          {copy.timeFormat}
        </p>
        <div className="flex flex-col gap-2">
          {TIME_PRESETS.map((preset) => (
            <label
              key={preset.value}
              className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]"
            >
              <input
                type="radio"
                name="timeFormat"
                value={preset.value}
                checked={timeFormat === preset.value}
                onChange={() => { setTimeFormat(preset.value); markDirty(); }}
                className="accent-[var(--color-accent)]"
              />
              <span>
                {preset.label}
                {preset.value !== "locale" && (
                  <span className="ml-1.5 text-[var(--color-text-muted)]">
                    — {formatTime(PREVIEW_DATE, preset.value)}
                  </span>
                )}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-medium text-[var(--color-text-secondary)]">
          {copy.relativeFormat}
        </p>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <input
            type="checkbox"
            checked={relativeFormat}
            onChange={(e) => { setRelativeFormat(e.target.checked); markDirty(); }}
            className="accent-[var(--color-accent)]"
          />
          {copy.relativeFormatHelp}
        </label>
      </div>

      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-bg-subtle)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">
        <span className="font-medium">{copy.preview}: </span>
        {previewDate} {previewTime}
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
        disabled={mutation.isPending}
        className="min-h-10 rounded-md bg-[var(--color-accent)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {copy.saveChanges}
      </button>
    </form>
  );
}
