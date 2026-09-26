export interface ThemeOption {
  id: string;
  name: string;
  swatch: string;
  isLight: boolean;
}

export const THEMES: ThemeOption[] = [
  { id: "satchel", name: "Satchel", swatch: "#d9a855", isLight: false },
  { id: "parchment", name: "Parchment", swatch: "#9c6a2c", isLight: true },
  { id: "terminal", name: "Terminal", swatch: "#4fd66b", isLight: false },
  { id: "nightshift", name: "Nightshift", swatch: "#5b8cff", isLight: false },
  { id: "sunbaked", name: "Sunbaked", swatch: "#f2994a", isLight: false },
  { id: "slate", name: "Slate", swatch: "#3fc1c9", isLight: false },
  { id: "postman", name: "Postman", swatch: "#ff6c37", isLight: false },
  { id: "vscode", name: "VS Code", swatch: "#007acc", isLight: false },
];

const STORAGE_KEY = "satchel.theme";
const DEFAULT_THEME = "satchel";

export function getStoredTheme(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored && THEMES.some((t) => t.id === stored) ? stored : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

export function applyTheme(themeId: string) {
  document.documentElement.dataset.theme = themeId;
  try {
    localStorage.setItem(STORAGE_KEY, themeId);
  } catch {
    // localStorage unavailable (private mode, etc.) — theme just won't persist
  }
}
