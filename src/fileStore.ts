import { save, open } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { isTauri } from "./platform";
import { parseWorkspace, serializeWorkspace } from "./workspace";
import type { Workspace } from "./types";

export class FileStoreError extends Error {}

const FILTERS = [{ name: "Satchel Workspace", extensions: ["json"] }];

export async function pickSaveLocation(): Promise<string | null> {
  if (!isTauri()) throw new FileStoreError("Saving to a file needs the desktop app — run with `npm run tauri dev`.");
  const path = await save({ filters: FILTERS, defaultPath: "satchel-workspace.json" });
  return path ?? null;
}

export async function pickOpenLocation(): Promise<string | null> {
  if (!isTauri()) throw new FileStoreError("Opening a file needs the desktop app — run with `npm run tauri dev`.");
  const path = await open({ filters: FILTERS, multiple: false });
  return typeof path === "string" ? path : null;
}

export async function writeWorkspaceFile(path: string, workspace: Workspace): Promise<void> {
  await writeTextFile(path, serializeWorkspace(workspace));
}

export async function readWorkspaceFile(path: string): Promise<Workspace> {
  const text = await readTextFile(path);
  return parseWorkspace(JSON.parse(text));
}

export function basename(path: string): string {
  return path.split(/[/\\]/).pop() ?? path;
}
