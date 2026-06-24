"use client";

import { useTheme } from "@/app/theme-provider";

const themeLabels: Record<string, string> = {
  light: "Light"
};

export function ThemeToggle() {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div className="mb-2 flex items-center gap-2 px-3 py-1 text-sm text-slate-500">
      <span className="shrink-0">Theme</span>
      <div className="flex gap-1">
        {themes.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTheme(t)}
            aria-pressed={theme === t}
            className={
              theme === t
                ? "rounded px-2 py-0.5 font-medium text-[var(--color-accent)]"
                : "rounded px-2 py-0.5 text-slate-400 hover:text-slate-600"
            }
          >
            {themeLabels[t] ?? t}
          </button>
        ))}
      </div>
    </div>
  );
}
