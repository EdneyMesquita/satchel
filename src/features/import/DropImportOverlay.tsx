import { useEffect, useRef } from "react";
import { useUi } from "@/state/ui";
import { listenForFileDrops, useFileDragging } from "./dragFiles";

/**
 * Drag a Postman export anywhere onto the window to import it. Shows a
 * full-window dashed outline while dragging (unless the import dialog is
 * already open — its own drop zone lights up instead) and hands dropped
 * files to the import dialog.
 */
export function DropImportOverlay() {
  const ui = useUi();
  const dragging = useFileDragging();
  const uiRef = useRef(ui);
  uiRef.current = ui;

  useEffect(
    () =>
      listenForFileDrops((files) => {
        if (uiRef.current.environmentDialog) return;
        uiRef.current.openPostmanDialog(files);
      }),
    [],
  );

  if (!dragging || ui.postmanDialog || ui.environmentDialog) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-2 z-[99] grid place-items-center rounded-[12px] border-2 border-dashed border-brass bg-[color-mix(in_srgb,var(--bg0)_88%,transparent)] text-[15px] font-medium"
    >
      Drop a Postman export to import it
    </div>
  );
}
