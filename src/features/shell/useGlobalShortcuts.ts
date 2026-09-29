import { useEffect, useLayoutEffect, useRef } from "react";
import { useWorkspace } from "@/state/workspace";
import { useSession, ENVIRONMENTS_TAB } from "@/state/session";
import { useUi } from "@/state/ui";
import { useAppActions } from "@/state/actions";

const CURL = /^\s*curl\s/i;

function dialogOpen(): boolean {
  return document.querySelector("[role=dialog][data-state=open]") !== null;
}

function isEditable(el: Element | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable;
}

/**
 * App-wide keyboard shortcuts and "paste a curl anywhere":
 * ⌘K palette · ⌘↵ send · ⌘E cycle env · ⌘1–9 pick env · ⌘N new request · Esc closes the sidebar overlay.
 */
export function useGlobalShortcuts() {
  const ws = useWorkspace();
  const session = useSession();
  const ui = useUi();
  const actions = useAppActions();

  // The listeners are attached once; they read the latest state through this ref.
  const latest = useRef({ ws, session, ui, actions });
  useLayoutEffect(() => {
    latest.current = { ws, session, ui, actions };
  });

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const { ws, session, ui, actions } = latest.current;
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();

      if (mod && !e.shiftKey && !e.altKey && key === "k") {
        e.preventDefault();
        if (ui.paletteOpen) ui.setPaletteOpen(false);
        else if (!dialogOpen()) ui.setPaletteOpen(true);
        return;
      }
      if (ui.paletteOpen || dialogOpen()) return;

      if (mod && e.key === "Enter") {
        const active = session.activeTab;
        if (!active || active === ENVIRONMENTS_TAB || !ws.findRequest(active)) return;
        e.preventDefault();
        // Let editors that commit on blur (body editor) flush before sending.
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && focused.isContentEditable) focused.blur();
        setTimeout(() => latest.current.session.send(active), 0);
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && key === "e") {
        e.preventDefault();
        actions.cycleEnvironment();
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && /^[1-9]$/.test(e.key)) {
        const env = ws.workspace.environments[Number(e.key) - 1];
        if (!env) return;
        e.preventDefault();
        actions.switchEnvironment(env.id);
        return;
      }
      if (mod && !e.shiftKey && !e.altKey && key === "n") {
        e.preventDefault();
        actions.newRequest();
        ui.setSidebarOpen(false);
        return;
      }
      if (e.key === "Escape" && ui.sidebarOpen) {
        ui.setSidebarOpen(false);
      }
    }

    function onPaste(e: ClipboardEvent) {
      const text = e.clipboardData?.getData("text") ?? "";
      if (!CURL.test(text)) return;
      if (dialogOpen() || latest.current.ui.paletteOpen) return;
      // Inputs (the URL field in particular) handle their own paste.
      if (isEditable(document.activeElement)) return;
      e.preventDefault();
      latest.current.actions.importCurlText(text);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("paste", onPaste);
    };
  }, []);
}
