"use client";

import { useEffect, useRef, useState } from "react";
import { parseQuantityValue, parseNumberValue } from "@/lib/quantityParsing";
import type { FilterControlProps } from "@/app/list-filter-config";
import {
  deserializeNumericFilter,
  serializeNumericFilter,
  RANGE_OPS,
  NUMERIC_OP_LABELS,
  NUMERIC_OPS_IN_ORDER,
  type NumericFilterOp
} from "@/app/numeric-filter-value";

type NumericFilterControlProps = FilterControlProps<string> & {
  label: string;
  /** Present for QUANTITY attributes (e.g. "Ω", "V", "F"). Absent for plain counts or NUMBER. */
  baseUnitSymbol?: string;
};

const inputClassName =
  "min-h-9 w-28 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-placeholder)] hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]";

const selectClassName =
  "min-h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-2 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]";

function tryParseValue(
  rawValue: string,
  baseUnitSymbol: string | undefined
): { ok: true } | { ok: false; error: string } {
  if (!rawValue.trim()) return { ok: true };
  if (baseUnitSymbol) {
    return parseQuantityValue({ rawValue, baseUnitSymbol });
  }
  return parseNumberValue({ rawValue });
}

export function NumericFilterControl({
  label,
  baseUnitSymbol,
  value,
  onChange,
  disabled = false
}: NumericFilterControlProps) {
  const [localOp, setLocalOp] = useState<NumericFilterOp>("gte");
  const [localV1, setLocalV1] = useState("");
  const [localV2, setLocalV2] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);

  // Track the last value we emitted so we can distinguish external prop changes
  // (e.g. "clear all" or URL navigation) from echoes of our own onChange calls.
  const lastEmittedRef = useRef(value);

  useEffect(() => {
    // If the incoming value is what we last emitted, it came from us — skip sync.
    if (value === lastEmittedRef.current) return;
    lastEmittedRef.current = value;

    const parsed = deserializeNumericFilter(value);
    if (!parsed) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalOp("gte");
      setLocalV1("");
      setLocalV2("");
      setParseError(null);
      return;
    }

    setLocalOp(parsed.op);
    if ("rawMin" in parsed) {
      setLocalV1(parsed.rawMin);
      setLocalV2(parsed.rawMax);
    } else {
      setLocalV1(parsed.rawValue);
      setLocalV2("");
    }
    setParseError(null);
  }, [value]);

  const isRange = RANGE_OPS.has(localOp);

  function computeAndEmit(op: NumericFilterOp, v1: string, v2: string) {
    const range = RANGE_OPS.has(op);
    const v1Empty = !v1.trim();
    const v2Empty = !v2.trim();

    if (range ? v1Empty && v2Empty : v1Empty) {
      setParseError(null);
      emitExternal("");
      return;
    }

    const r1 = tryParseValue(v1, baseUnitSymbol);
    const r2 = range ? tryParseValue(v2, baseUnitSymbol) : { ok: true as const };

    if (!r1.ok || !r2.ok) {
      const err = !r1.ok ? r1.error : !r2.ok ? r2.error : null;
      setParseError(err ?? "invalid-value");
      emitExternal("");
      return;
    }

    setParseError(null);

    let serialized: string;
    if (op === "between" || op === "not-between") {
      if (v1Empty || v2Empty) {
        emitExternal("");
        return;
      }
      serialized = serializeNumericFilter({ op, rawMin: v1, rawMax: v2 });
    } else {
      serialized = serializeNumericFilter({
        op: op as "eq" | "neq" | "gt" | "gte" | "lt" | "lte",
        rawValue: v1
      });
    }

    emitExternal(serialized);
  }

  function emitExternal(serialized: string) {
    lastEmittedRef.current = serialized;
    onChange(serialized);
  }

  function handleOpChange(newOp: NumericFilterOp) {
    setLocalOp(newOp);
    computeAndEmit(newOp, localV1, localV2);
  }

  function handleV1Change(raw: string) {
    setLocalV1(raw);
    computeAndEmit(localOp, raw, localV2);
  }

  function handleV2Change(raw: string) {
    setLocalV2(raw);
    computeAndEmit(localOp, localV1, raw);
  }

  const placeholder = baseUnitSymbol ? `e.g. 10 ${baseUnitSymbol}` : "value";
  const errorId = `numeric-filter-error-${label.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</span>
      <div className="flex items-center gap-1.5">
        <select
          aria-label={`${label} operator`}
          className={selectClassName}
          disabled={disabled}
          value={localOp}
          onChange={(e) => handleOpChange(e.currentTarget.value as NumericFilterOp)}
        >
          {NUMERIC_OPS_IN_ORDER.map((op) => (
            <option key={op} value={op}>
              {NUMERIC_OP_LABELS[op]}
            </option>
          ))}
        </select>

        <input
          aria-describedby={parseError ? errorId : undefined}
          aria-label={isRange ? `${label} minimum` : label}
          className={inputClassName}
          disabled={disabled}
          placeholder={isRange ? `min (${placeholder})` : placeholder}
          type="text"
          value={localV1}
          onChange={(e) => handleV1Change(e.currentTarget.value)}
        />

        {isRange && (
          <>
            <span className="text-sm text-[var(--color-text-secondary)]">to</span>
            <input
              aria-describedby={parseError ? errorId : undefined}
              aria-label={`${label} maximum`}
              className={inputClassName}
              disabled={disabled}
              placeholder={`max (${placeholder})`}
              type="text"
              value={localV2}
              onChange={(e) => handleV2Change(e.currentTarget.value)}
            />
          </>
        )}
      </div>

      {parseError && (
        <span
          className="text-xs text-[var(--color-error,theme(colors.red.600))]"
          id={errorId}
          role="alert"
        >
          {parseError === "invalid-quantity-unit"
            ? `Invalid unit — expected ${baseUnitSymbol}`
            : "Invalid value"}
        </span>
      )}
    </div>
  );
}
