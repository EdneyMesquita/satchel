import { createContext, useContext, useState, type ReactNode } from "react";

/** Transient UI: which overlay is open. */

export type EnvironmentDialogState =
  | { mode: "create"; copyFromId?: string }
  | { mode: "rename"; environmentId: string };

interface UiValue {
  paletteOpen: boolean;
  setPaletteOpen: (open: boolean) => void;

  environmentDialog: EnvironmentDialogState | null;
  openEnvironmentDialog: (state: EnvironmentDialogState) => void;
  closeEnvironmentDialog: () => void;

  /** Postman import dialog; `files` are dropped files to process on open */
  postmanDialog: { files: File[] } | null;
  openPostmanDialog: (files?: File[]) => void;
  closePostmanDialog: () => void;

  /** Force the first-run screen (palette → "Show first-run"); otherwise it shows when the workspace is empty. */
  forceFirstRun: boolean;
  setForceFirstRun: (v: boolean) => void;

  /** Narrow windows: the sidebar becomes an overlay toggled from the header. */
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
}

const UiContext = createContext<UiValue | null>(null);

export function UiProvider({ children }: { children: ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [environmentDialog, setEnvironmentDialog] = useState<EnvironmentDialogState | null>(null);
  const [postmanDialog, setPostmanDialog] = useState<{ files: File[] } | null>(null);
  const [forceFirstRun, setForceFirstRun] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const value: UiValue = {
    paletteOpen,
    setPaletteOpen,
    environmentDialog,
    openEnvironmentDialog: (s) => {
      setPaletteOpen(false);
      setEnvironmentDialog(s);
    },
    closeEnvironmentDialog: () => setEnvironmentDialog(null),
    postmanDialog,
    openPostmanDialog: (files = []) => {
      setPaletteOpen(false);
      setPostmanDialog({ files });
    },
    closePostmanDialog: () => setPostmanDialog(null),
    forceFirstRun,
    setForceFirstRun,
    sidebarOpen,
    setSidebarOpen,
  };
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi(): UiValue {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi must be used inside <UiProvider>");
  return ctx;
}
