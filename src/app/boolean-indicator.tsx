// Renders a read-only boolean as an icon instead of "Yes"/"No" text (#17): a check mark in the
// success colour for true, a muted cross for false. The text is kept for screen readers and as a
// hover tooltip, so the label stays localizable copy supplied by the caller.
export function BooleanIndicator({ value, label }: { value: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center align-middle ${
        value ? "text-[var(--color-success)]" : "text-[var(--color-text-muted)]"
      }`}
      title={label}
    >
      <svg
        aria-hidden="true"
        className="h-4 w-4"
        viewBox="0 0 20 20"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d={value ? "M4.5 10.5 8.25 14.25 15.5 6" : "M6 6l8 8m0-8-8 8"}
          stroke="currentColor"
          strokeWidth={value ? 2 : 1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  );
}
