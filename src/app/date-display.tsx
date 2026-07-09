"use client";

import { useDateFormatPrefs } from "@/app/date-format-context";

const RELATIVE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function formatDate(date: Date, preset: string): string {
  if (preset === "abbr") {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }
  if (preset === "YMD") {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (preset === "DMY") {
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${d}/${m}/${date.getFullYear()}`;
  }
  if (preset === "MDY") {
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${m}/${d}/${date.getFullYear()}`;
  }
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

export function formatTime(date: Date, preset: string): string {
  if (preset === "12h") {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true
    }).format(date);
  }
  if (preset === "24h") {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, { timeStyle: "short" }).format(date);
}

function formatDateTime(date: Date, datePreset: string, timePreset: string): string {
  if (datePreset === "locale" && timePreset === "locale") {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date);
  }
  return `${formatDate(date, datePreset)} ${formatTime(date, timePreset)}`;
}

function formatRelative(value: Date | string | number): string {
  const diffMs = new Date(value).getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

  if (absMs < 60_000) return rtf.format(Math.round(diffMs / 1_000), "second");
  if (absMs < 3_600_000) return rtf.format(Math.round(diffMs / 60_000), "minute");
  if (absMs < 86_400_000) return rtf.format(Math.round(diffMs / 3_600_000), "hour");
  if (absMs < 604_800_000) return rtf.format(Math.round(diffMs / 86_400_000), "day");
  if (absMs < 2_592_000_000) return rtf.format(Math.round(diffMs / 604_800_000), "week");
  if (absMs < 31_536_000_000) return rtf.format(Math.round(diffMs / 2_592_000_000), "month");
  return rtf.format(Math.round(diffMs / 31_536_000_000), "year");
}

function isRecent(value: Date | string | number): boolean {
  return Math.abs(Date.now() - new Date(value).getTime()) < RELATIVE_THRESHOLD_MS;
}

export function useDateFormat(): (value: Date | string | number) => string {
  const { dateFormat } = useDateFormatPrefs();
  return (value) => formatDate(new Date(value), dateFormat);
}

export function useDateTimeFormat(): (value: Date | string | number) => string {
  const { dateFormat, timeFormat } = useDateFormatPrefs();
  return (value) => formatDateTime(new Date(value), dateFormat, timeFormat);
}

interface DateDisplayProps {
  value: Date | string | number;
  relative?: boolean;
  className?: string;
}

export function DateDisplay({ value, relative, className }: DateDisplayProps) {
  const format = useDateFormat();
  const { relativeFormat } = useDateFormatPrefs();
  const useRelative = relative || (relativeFormat && isRecent(value));
  const absolute = format(value);
  if (useRelative) {
    return (
      <span className={className} title={absolute} aria-label={absolute}>
        {formatRelative(value)}
      </span>
    );
  }
  return <span className={className}>{absolute}</span>;
}

export function DateTimeDisplay({ value, relative, className }: DateDisplayProps) {
  const format = useDateTimeFormat();
  const { relativeFormat } = useDateFormatPrefs();
  const useRelative = relative || (relativeFormat && isRecent(value));
  const absolute = format(value);
  if (useRelative) {
    return (
      <span className={className} title={absolute} aria-label={absolute}>
        {formatRelative(value)}
      </span>
    );
  }
  return <span className={className}>{absolute}</span>;
}
