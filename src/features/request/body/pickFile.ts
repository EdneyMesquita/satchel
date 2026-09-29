import { open } from "@tauri-apps/plugin-dialog";
import { stat } from "@tauri-apps/plugin-fs";
import { isTauri } from "@/platform";

export interface PickedFile {
  fileName: string;
  /** Absolute path on disk (desktop only). The browser can't expose one. */
  filePath?: string;
  fileSize?: number;
}

const basename = (path: string) => path.split(/[/\\]/).pop() ?? path;

/** Desktop: native dialog + stat for the size. Browser: a hidden <input type=file> (name and size only). */
export async function pickFile(): Promise<PickedFile | null> {
  if (isTauri()) {
    const picked = await open({ multiple: false, directory: false });
    const path = typeof picked === "string" ? picked : null;
    if (!path) return null;
    let fileSize: number | undefined;
    try {
      fileSize = (await stat(path)).size;
    } catch {
      // size is informational only
    }
    return { fileName: basename(path), filePath: path, fileSize };
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.style.display = "none";
    input.addEventListener("change", () => {
      const f = input.files?.[0];
      input.remove();
      resolve(f ? { fileName: f.name, fileSize: f.size } : null);
    });
    input.addEventListener("cancel", () => {
      input.remove();
      resolve(null);
    });
    document.body.appendChild(input);
    input.click();
  });
}
