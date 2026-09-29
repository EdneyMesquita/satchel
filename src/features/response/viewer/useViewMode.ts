import { useCallback, useEffect, useState } from "react";

export type ViewMode = "pretty" | "tree" | "raw";

const KEY = "satchel.responseView";

function load(): ViewMode {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "pretty" || v === "tree" || v === "raw") return v;
  } catch {
    // storage unavailable
  }
  return "pretty";
}

/**
 * The response view mode, remembered across restarts and shared by the response pane and the
 * pop-out window (same origin, so the `storage` event keeps them in step).
 */
export function useViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState(load);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setMode(load());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const set = useCallback((next: ViewMode) => {
    setMode(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // storage unavailable
    }
  }, []);

  return [mode, set];
}
