import { useEffect, useRef, useState } from "react";
import { THEMES, applyTheme, getStoredTheme } from "../themes";

function PaletteIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5a6.3 6.3 0 1 0 0 12.6c.7 0 1.2-.55 1.2-1.2 0-.32-.13-.6-.33-.82a1.1 1.1 0 0 1-.28-.73c0-.63.52-1.15 1.15-1.15h1.35A2.9 2.9 0 0 0 14 7.3C14 4.1 11.3 1.5 8 1.5z" />
      <circle cx="4.6" cy="7" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="6.8" cy="4.3" r="0.85" fill="currentColor" stroke="none" />
      <circle cx="9.9" cy="4.7" r="0.85" fill="currentColor" stroke="none" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8.5 6.2 12 13 4" />
    </svg>
  );
}

export function ThemeSwitcher() {
  const [open, setOpen] = useState(false);
  const [themeId, setThemeId] = useState(getStoredTheme);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function pick(id: string) {
    applyTheme(id);
    setThemeId(id);
    setOpen(false);
  }

  return (
    <div className="theme-switcher" ref={ref}>
      <button className="theme-switcher-btn" onClick={() => setOpen((o) => !o)} title="Color theme">
        <PaletteIcon />
      </button>
      {open && (
        <div className="theme-menu">
          {THEMES.map((theme) => (
            <button key={theme.id} className="theme-menu-item" onClick={() => pick(theme.id)}>
              <span className="theme-swatch" style={{ background: theme.swatch }} />
              <span className="theme-name">{theme.name}</span>
              {themeId === theme.id && <CheckIcon />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
