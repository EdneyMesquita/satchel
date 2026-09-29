import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "satchel.theme";
// Older builds stored one of eight named themes; the light one was "parchment".
const LEGACY_LIGHT = new Set(["light", "parchment"]);

function storedTheme(): Theme {
  try {
    return LEGACY_LIGHT.has(localStorage.getItem(STORAGE_KEY) ?? "") ? "light" : "dark";
  } catch {
    return "dark";
  }
}

/** Apply before first render so there's no dark→light flash. */
export function applyStoredTheme() {
  document.documentElement.dataset.theme = storedTheme();
}

interface ThemeValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(storedTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // storage unavailable — the theme just won't persist
    }
  }, [theme]);

  // Keep every window (main + response windows) on the same theme.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setTheme(storedTheme());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggleTheme = useCallback(() => setTheme((t) => (t === "dark" ? "light" : "dark")), []);
  return <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
