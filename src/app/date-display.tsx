"use client";

// #181 will replace the fixed Intl instances here with user-configured formatters.
// Components and callers already read from one place so no call sites need updating.

const dateFormatter = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  dateStyle: "medium",
  timeStyle: "short"
});

export function useDateFormat(): (value: Date | string | number) => string {
  return (value) => dateFormatter.format(new Date(value));
}

export function useDateTimeFormat(): (value: Date | string | number) => string {
  return (value) => dateTimeFormatter.format(new Date(value));
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

interface DateDisplayProps {
  value: Date | string | number;
  relative?: boolean;
  className?: string;
}

export function DateDisplay({ value, relative, className }: DateDisplayProps) {
  const format = useDateFormat();
  const absolute = format(value);
  if (relative) {
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
  const absolute = format(value);
  if (relative) {
    return (
      <span className={className} title={absolute} aria-label={absolute}>
        {formatRelative(value)}
      </span>
    );
  }
  return <span className={className}>{absolute}</span>;
}
