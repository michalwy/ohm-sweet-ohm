"use client";

import { useEffect, useRef, useState } from "react";
import type { FilterControlProps } from "@/app/list-filter-config";
import {
  deserializeDateRangeFilter,
  serializeDateRangeFilter,
  isValidIsoDate
} from "@/app/date-range-filter-value";

type DateRangeFilterControlProps = FilterControlProps<string> & {
  label: string;
};

const inputClassName =
  "min-h-9 w-40 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-placeholder)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]";

export function DateRangeFilterControl({
  label,
  value,
  onChange,
  disabled = false
}: DateRangeFilterControlProps) {
  const [localFrom, setLocalFrom] = useState("");
  const [localTo, setLocalTo] = useState("");
  const [rangeError, setRangeError] = useState(false);

  const lastEmittedRef = useRef(value);

  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;

    const parsed = deserializeDateRangeFilter(value);
    if (!parsed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalFrom("");
      setLocalTo("");
      setRangeError(false);
      return;
    }

    if (parsed.op === "after") {
      setLocalFrom(parsed.from);
      setLocalTo("");
    } else if (parsed.op === "before") {
      setLocalFrom("");
      setLocalTo(parsed.to);
    } else {
      setLocalFrom(parsed.from);
      setLocalTo(parsed.to);
    }
    setRangeError(false);
  }, [value]);

  function computeAndEmit(from: string, to: string) {
    const fromValid = from && isValidIsoDate(from);
    const toValid = to && isValidIsoDate(to);

    if (!fromValid && !toValid) {
      setRangeError(false);
      emitExternal("");
      return;
    }

    if (fromValid && toValid && from > to) {
      setRangeError(true);
      emitExternal("");
      return;
    }

    setRangeError(false);

    let serialized: string;
    if (fromValid && toValid) {
      serialized = serializeDateRangeFilter({ op: "between", from, to });
    } else if (fromValid) {
      serialized = serializeDateRangeFilter({ op: "after", from });
    } else {
      serialized = serializeDateRangeFilter({ op: "before", to: to as string });
    }

    emitExternal(serialized);
  }

  function emitExternal(serialized: string) {
    lastEmittedRef.current = serialized;
    onChange(serialized);
  }

  function handleFromChange(from: string) {
    setLocalFrom(from);
    computeAndEmit(from, localTo);
  }

  function handleToChange(to: string) {
    setLocalTo(to);
    computeAndEmit(localFrom, to);
  }

  const errorId = `date-range-filter-error-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          aria-describedby={rangeError ? errorId : undefined}
          aria-label={`${label} from`}
          className={inputClassName}
          disabled={disabled}
          type="date"
          value={localFrom}
          onChange={(e) => handleFromChange(e.currentTarget.value)}
        />
        <span className="text-sm text-[var(--color-text-secondary)]">–</span>
        <input
          aria-describedby={rangeError ? errorId : undefined}
          aria-label={`${label} to`}
          className={inputClassName}
          disabled={disabled}
          type="date"
          value={localTo}
          onChange={(e) => handleToChange(e.currentTarget.value)}
        />
      </div>

      {rangeError && (
        <span
          className="text-xs text-[var(--color-error,theme(colors.red.600))]"
          id={errorId}
          role="alert"
        >
          &ldquo;From&rdquo; date must be on or before &ldquo;to&rdquo; date
        </span>
      )}
    </div>
  );
}
