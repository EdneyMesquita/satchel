import { exists, mkdir, readDir, readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import type { Workspace } from "./types";
import {
  applyPlanToMap,
  COLLECTIONS_DIR,
  ENVIRONMENTS_DIR,
  filesToWorkspace,
  isManagedPath,
  LOCAL_FILE,
  LOCAL_GITIGNORE,
  planWrite,
  ROOT_FILE,
  workspaceToFiles,
  WorkspaceFolderError,
  type FileMap,
  type FolderLoad,
} from "./folderFormat";

/**
 * Workspace folders on disk (desktop app only). The pure format lives in
 * folderFormat/; this module only walks directories and applies write plans.
 */

/** Deeper than any real collection; stops a symlink loop or a runaway tree. */
const MAX_DEPTH = 24;

const join = (root: string, rel: string) => `${root.replace(/[\\/]+$/, "")}/${rel}`;

async function walk(root: string, rel: string, depth: number, out: FileMap): Promise<void> {
  if (depth > MAX_DEPTH) return;
  let entries;
  try {
    entries = await readDir(join(root, rel));
  } catch {
    return; // the directory doesn't exist (yet) — nothing to read
  }
  for (const e of entries) {
    if (e.isSymlink || e.name.startsWith(".")) continue;
    const path = `${rel}/${e.name}`;
    if (e.isDirectory) await walk(root, path, depth + 1, out);
    else if (e.isFile && isManagedPath(path)) out.set(path, await readTextFile(join(root, path)));
  }
}

/** Every file the format owns under `root`, as relative path → content. */
export async function readManagedFiles(root: string): Promise<FileMap> {
  const files: FileMap = new Map();
  for (const rel of [ROOT_FILE, LOCAL_FILE, LOCAL_GITIGNORE]) {
    try {
      if (await exists(join(root, rel))) files.set(rel, await readTextFile(join(root, rel)));
    } catch {
      // unreadable: treated as absent
    }
  }
  await walk(root, COLLECTIONS_DIR, 0, files);
  await walk(root, ENVIRONMENTS_DIR, 0, files);
  return files;
}

export interface OpenedFolder extends FolderLoad {
  root: string;
  /** The managed files as they are on disk now: the baseline for the next save. */
  files: FileMap;
}

export async function openWorkspaceFolder(root: string): Promise<OpenedFolder> {
  const files = await readManagedFiles(root);
  return { root, files, ...filesToWorkspace(files, root) };
}

async function removeIfEmpty(path: string) {
  try {
    if ((await readDir(path)).length === 0) await remove(path);
  } catch {
    // gone already, or not empty — either way nothing to do
  }
}

/**
 * Write `workspace` into `root`, touching only files whose content changed.
 * `current` is what was last read or written; returns the new baseline.
 */
export async function saveWorkspaceFolder(
  root: string,
  workspace: Workspace,
  current: FileMap,
  protectedPaths: readonly string[] = [],
): Promise<FileMap> {
  const plan = planWrite(current, workspaceToFiles(workspace, root), protectedPaths);
  const made = new Set<string>();
  for (const [rel, content] of plan.writes) {
    const dir = rel.includes("/") ? rel.slice(0, rel.lastIndexOf("/")) : "";
    if (dir && !made.has(dir)) {
      await mkdir(join(root, dir), { recursive: true });
      made.add(dir);
    }
    await writeTextFile(join(root, rel), content);
  }
  for (const rel of plan.deletes) {
    try {
      await remove(join(root, rel));
    } catch {
      // already gone (e.g. deleted by hand) — the goal is reached
    }
  }
  for (const dir of plan.pruneDirs) await removeIfEmpty(join(root, dir));
  return applyPlanToMap(current, plan);
}

/**
 * Turn a workspace (e.g. a legacy single .json file) into a new workspace
 * folder. Refuses a folder that already holds a Satchel workspace.
 */
export async function createWorkspaceFolder(root: string, workspace: Workspace): Promise<FileMap> {
  if (await exists(join(root, ROOT_FILE))) {
    throw new WorkspaceFolderError("That folder already has a Satchel workspace. Open it instead, or pick an empty folder.");
  }
  return saveWorkspaceFolder(root, workspace, new Map());
}
