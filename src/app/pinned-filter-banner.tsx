type PinnedFilterBannerProps = {
  label: string;
  clearLabel: string;
  onClear: () => void;
};

export function PinnedFilterBanner({ label, clearLabel, onClear }: PinnedFilterBannerProps) {
  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-accent-soft)] px-4 py-2">
      <span className="text-sm text-[var(--color-text-primary)]">{label}</span>
      <button
        type="button"
        className="ml-auto text-sm font-medium text-[var(--color-accent)] hover:underline focus:outline-none"
        onClick={onClear}
      >
        {clearLabel}
      </button>
    </div>
  );
}
