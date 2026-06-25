"use client";

import { createContext, useContext, useEffect, useState } from "react";

export type Theme = "auto" | "light" | "dark";

const THEMES: Theme[] = ["auto", "light", "dark"];
const STORAGE_KEY = "oso:theme";

function readSavedTheme(): Theme {
  if (typeof window === "undefined") return "auto";
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved && (THEMES as string[]).includes(saved) ? (saved as Theme) : "auto";
}

function applyThemeClass(resolved: "light" | "dark") {
  document.documentElement.classList.remove("theme-light", "theme-dark");
  document.documentElement.classList.add(`theme-${resolved}`);
}

function resolveAuto(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  themes: readonly Theme[];
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: "auto",
  setTheme: () => undefined,
  themes: THEMES
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readSavedTheme);

  function setTheme(next: Theme) {
    applyThemeClass(next === "auto" ? resolveAuto() : next);
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }

  useEffect(() => {
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) =>
      applyThemeClass(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}
