"use client";

type BooleanFilterControlProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function BooleanFilterControl({
  label,
  value,
  onChange,
  disabled = false
}: BooleanFilterControlProps) {
  return (
    <label className="grid gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
      {label}
      <select
        className="min-h-9 rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] outline-none transition hover:border-[var(--color-border-hover)] focus:border-[var(--color-border-hover)] focus:ring-2 focus:ring-[var(--color-ring)]"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
      >
        <option value="">Any</option>
        <option value="true">Yes</option>
        <option value="false">No</option>
      </select>
    </label>
  );
}
