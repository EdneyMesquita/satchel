import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { basename } from "./fileStore";
import { isTauri } from "./platform";

export interface SaveTextOptions {
  /** suggested file name, e.g. "users-2026-10-07.csv" */
  name: string;
  /** shown in the desktop save dialog, e.g. { name: "CSV", extensions: ["csv"] } */
  filter: { name: string; extensions: string[] };
  /** for the browser download */
  mime: string;
}

export interface SavedFile {
  /** the file name the user ended up with */
  name: string;
  /** false in the browser: the text went to the downloads folder */
  desktop: boolean;
}

/**
 * Save text to a file the user picks. On the desktop: the native save
 * dialog, then a write (null when the dialog is cancelled). In the browser:
 * a download with the suggested name.
 */
export async function saveTextAs(text: string, { name, filter, mime }: SaveTextOptions): Promise<SavedFile | null> {
  if (isTauri()) {
    const path = await save({ defaultPath: name, filters: [filter] });
    if (!path) return null;
    await writeTextFile(path, text);
    return { name: basename(path), desktop: true };
  }
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked later: some browsers start reading the blob after click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return { name, desktop: false };
}
