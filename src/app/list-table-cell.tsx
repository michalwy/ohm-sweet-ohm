// Renders a placeholder for table cells with no value.
// Use in place of any inline hyphen or em-dash fallback in column definitions.
export function EmptyCell() {
  return (
    <span className="text-[var(--color-text-placeholder)]">
      <span aria-hidden="true">—</span>
      <span className="sr-only">no value</span>
    </span>
  );
}
