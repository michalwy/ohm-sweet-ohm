"use client";

import { createContext, useContext, useState } from "react";

export type Theme = "light" | "dark";

const THEMES: Theme[] = ["light", "dark"];
const STORAGE_KEY = "oso:theme";

function readSavedTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved && (THEMES as string[]).includes(saved) ? (saved as Theme) : "light";
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themes: readonly Theme[];
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "light",
  setTheme: () => undefined,
  themes: THEMES
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readSavedTheme);

  function setTheme(next: Theme) {
    for (const t of THEMES) {
      document.documentElement.classList.remove(`theme-${t}`);
    }
    document.documentElement.classList.add(`theme-${next}`);
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}
