import { useSyncExternalStore } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { isTauri } from "@/platform";

/**
 * Files dragged onto the window from the OS.
 *
 * Desktop: Tauri's native drag-drop (the window keeps `dragDropEnabled` on)
 * hands us file paths, which we read into File objects. We don't rely on
 * HTML5 drag events there: WebKitGTK (Linux) can report a file drag as
 * `text/uri-list` instead of `Files`, and any drop that isn't cancelled makes
 * the webview navigate to the file — replacing the app with raw JSON.
 *
 * Browser (vite dev): plain HTML5 events, always cancelled for the same reason.
 */

let dragging = false;
const listeners = new Set<() => void>();

function setDragging(value: boolean) {
  if (dragging === value) return;
  dragging = value;
  listeners.forEach((l) => l());
}

/** True while files are being dragged over the window. */
export function useFileDragging(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => dragging,
  );
}

const basename = (path: string) => path.split(/[/\\]/).pop() ?? path;

async function filesFromPaths(paths: string[]): Promise<File[]> {
  const files = await Promise.all(
    paths.map(async (path) => {
      try {
        return new File([await readTextFile(path)], basename(path), { type: "application/json" });
      } catch {
        return null; // unreadable (a folder, permissions…) — skip it
      }
    }),
  );
  return files.filter((f): f is File => f !== null);
}

function isFileDrag(e: DragEvent): boolean {
  const types = Array.from(e.dataTransfer?.types ?? []);
  return types.includes("Files") || types.includes("text/uri-list");
}

/**
 * Start listening for file drops on the window. `onFiles` gets the dropped
 * files (never empty). Returns a stop function.
 */
export function listenForFileDrops(onFiles: (files: File[]) => void): () => void {
  // Never let a drop navigate the webview, whatever the drag carries.
  const cancel = (e: DragEvent) => e.preventDefault();
  window.addEventListener("dragover", cancel);
  window.addEventListener("drop", cancel);
  const stopDom = () => {
    window.removeEventListener("dragover", cancel);
    window.removeEventListener("drop", cancel);
  };

  if (isTauri()) {
    let unlisten: (() => void) | null = null;
    let stopped = false;
    getCurrentWebview()
      .onDragDropEvent(async (event) => {
        const p = event.payload;
        if (p.type === "enter") setDragging(p.paths.length > 0);
        else if (p.type === "leave") setDragging(false);
        else if (p.type === "drop") {
          setDragging(false);
          const files = await filesFromPaths(p.paths);
          if (files.length) onFiles(files);
        }
      })
      .then((fn) => {
        if (stopped) fn();
        else unlisten = fn;
      });
    return () => {
      stopped = true;
      unlisten?.();
      stopDom();
      setDragging(false);
    };
  }

  let depth = 0;
  const enter = (e: DragEvent) => {
    if (!isFileDrag(e)) return;
    depth++;
    setDragging(true);
  };
  const leave = (e: DragEvent) => {
    if (!isFileDrag(e)) return;
    if (--depth <= 0) {
      depth = 0;
      setDragging(false);
    }
  };
  const drop = (e: DragEvent) => {
    depth = 0;
    setDragging(false);
    const files = Array.from(e.dataTransfer?.files ?? []);
    if (files.length) onFiles(files);
  };
  const end = () => {
    depth = 0;
    setDragging(false);
  };
  window.addEventListener("dragenter", enter);
  window.addEventListener("dragleave", leave);
  window.addEventListener("drop", drop);
  window.addEventListener("dragend", end);
  return () => {
    window.removeEventListener("dragenter", enter);
    window.removeEventListener("dragleave", leave);
    window.removeEventListener("drop", drop);
    window.removeEventListener("dragend", end);
    stopDom();
    setDragging(false);
  };
}
