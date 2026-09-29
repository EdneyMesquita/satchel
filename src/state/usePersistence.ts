import { useCallback, useEffect, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { exists, watch } from "@tauri-apps/plugin-fs";
import { toast } from "sonner";
import type { Workspace } from "@/types";
import { emptyWorkspace, parseWorkspace } from "@/workspace";
import { basename, pickOpenLocation, pickSaveLocation, readWorkspaceFile, writeWorkspaceFile } from "@/fileStore";
import { createWorkspaceFolder, openWorkspaceFolder, readManagedFiles, saveWorkspaceFolder } from "@/folderStore";
import { filesToWorkspace, isManagedPath, relativeInside, ROOT_FILE, WorkspaceFolderError, type FileMap, type Problem } from "@/folderFormat";
import { isTauri } from "@/platform";
import {
  fileMapsEqual,
  folderName,
  loadRecents,
  loadSource,
  storeRecents,
  storeSource,
  withoutRecent,
  withRecent,
  type WorkspaceSource,
} from "./sources";

/**
 * Keeps the in-memory workspace and its source in step:
 * - cache: the app's localStorage scratch space, before anything is chosen
 * - file: a legacy single .json file
 * - folder: a workspace folder (usually a git repository), written file by file
 *
 * Saving is automatic and debounced (it is not git sync: nothing is committed
 * or pushed). A folder is watched, so a `git pull` or a branch switch in a
 * terminal reloads the workspace; changes on disk win over unsaved ones.
 */

/** The app's scratch workspace, used while no file or folder is chosen. */
const CACHE_KEY = "satchel.workspace.cache";
/** A copy of the last opened file/folder, shown while it (re)loads so tabs and the tree don't flash empty. */
const MIRROR_KEY = "satchel.workspace.mirror";
const SAVE_DELAY = 400;
const RELOAD_DELAY = 250;

export type SaveState = "saved" | "saving" | "cache" | "error";

export type OpenFolderResult =
  | { status: "opened"; root: string; problems: number }
  | { status: "cancelled" }
  /** The folder has no satchel.json: offer to create a workspace there. */
  | { status: "not-workspace"; root: string }
  | { status: "failed"; message: string };

function loadStored(key: string): Workspace {
  try {
    const raw = localStorage.getItem(key);
    return raw ? parseWorkspace({ ...emptyWorkspace(), ...JSON.parse(raw) }) : emptyWorkspace();
  } catch {
    return emptyWorkspace();
  }
}

function store(key: string, w: Workspace) {
  try {
    localStorage.setItem(key, JSON.stringify(w));
  } catch {
    // storage full or unavailable
  }
}

const loadCache = () => loadStored(CACHE_KEY);

/** What to show on the very first render, before the file or folder has been read. */
export function initialWorkspace(): Workspace {
  return loadSource().kind === "cache" ? loadCache() : loadStored(MIRROR_KEY);
}

const message = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

async function pickFolder(title: string): Promise<string | null> {
  if (!isTauri()) throw new Error("Workspace folders need the desktop app — run with `npm run tauri dev`.");
  const picked = await openDialog({ directory: true, multiple: false, title });
  return typeof picked === "string" ? picked : null;
}

export function usePersistence(workspace: Workspace, setWorkspace: (w: Workspace) => void) {
  const [source, setSourceState] = useState<WorkspaceSource>(loadSource);
  const [saveState, setSaveState] = useState<SaveState>(() => (loadSource().kind === "cache" ? "cache" : "saved"));
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [recentFolders, setRecents] = useState<string[]>(loadRecents);

  // Folder bookkeeping lives in refs: the save/reload callbacks read it between renders.
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  /** managed files as last read or written — the baseline for the next save */
  const baseline = useRef<FileMap>(new Map());
  const protectedPaths = useRef<string[]>([]);
  /** the next workspace change came from disk (or a switch), not the user: don't save it back */
  // true at first: the initial render shows the cache/mirror, which must never be written over the real source
  const skipNextSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saving = useRef<Promise<void>>(Promise.resolve());
  const busy = useRef(false);
  const reloadWanted = useRef(false);
  /** set when the folder stopped being a workspace (e.g. a branch without satchel.json): never write into it */
  const frozen = useRef(false);

  const setSource = useCallback((s: WorkspaceSource) => {
    storeSource(s);
    sourceRef.current = s;
    setSourceState(s);
    if (s.kind === "folder") {
      setRecents((list) => {
        const next = withRecent(list, s.root);
        storeRecents(next);
        return next;
      });
    }
  }, []);

  /** Replace the in-memory workspace without writing it back. */
  const adopt = useCallback(
    (w: Workspace) => {
      skipNextSave.current = true;
      setWorkspace(w);
    },
    [setWorkspace],
  );

  const applyFolderLoad = useCallback(
    (root: string, files: FileMap) => {
      const load = filesToWorkspace(files, root);
      frozen.current = false;
      baseline.current = files;
      protectedPaths.current = load.protectedPaths;
      setProblems(load.problems);
      adopt(load.workspace);
      return load;
    },
    [adopt],
  );

  const cancelPendingSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
  };

  /** Write the workspace to its source now (one write at a time). */
  const writeNow = useCallback((w: Workspace): Promise<void> => {
    const run = async () => {
      const s = sourceRef.current;
      if (s.kind === "cache") return;
      busy.current = true;
      setSaveState("saving");
      try {
        if (s.kind === "file") await writeWorkspaceFile(s.path, w);
        else if (frozen.current) {
          setSaveState("error");
          return;
        } else baseline.current = await saveWorkspaceFolder(s.root, w, baseline.current, protectedPaths.current);
        setSaveState("saved");
      } catch (err) {
        setSaveState("error");
        setError(message(err, "Couldn't save the workspace."));
      } finally {
        busy.current = false;
      }
    };
    saving.current = saving.current.then(run, run);
    return saving.current;
  }, []);

  /** Save whatever is pending right away (before switching to another workspace). */
  const flush = useCallback(async () => {
    if (saveTimer.current) {
      cancelPendingSave();
      await writeNow(workspaceRef.current);
    } else {
      await saving.current;
    }
  }, [writeNow]);

  // Autosave: cache in the app until a file or folder is chosen; debounce-write to it after.
  useEffect(() => {
    store(sourceRef.current.kind === "cache" ? CACHE_KEY : MIRROR_KEY, workspace);
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (sourceRef.current.kind === "cache") return;
    setSaveState("saving");
    cancelPendingSave();
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      void writeNow(workspace).then(() => {
        if (reloadWanted.current) void reloadFromDisk();
      });
    }, SAVE_DELAY);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reloadFromDisk is stable in practice
  }, [workspace, writeNow]);

  /** Stop writing into the folder (it isn't a usable workspace right now) and say why. */
  const freeze = (why: string) => {
    frozen.current = true;
    cancelPendingSave();
    setSaveState("error");
    setError(why);
  };

  /** Re-read the folder; adopt it when it differs from what we last wrote. */
  const reloadFromDisk = useCallback(async (): Promise<boolean> => {
    const s = sourceRef.current;
    if (s.kind !== "folder") return false;
    if (busy.current) {
      reloadWanted.current = true; // our own write is in flight: check again once it's done
      return false;
    }
    reloadWanted.current = false;
    let files: FileMap;
    try {
      files = await readManagedFiles(s.root);
    } catch (err) {
      setError(message(err, "Couldn't read the workspace folder."));
      return false;
    }
    if (sourceRef.current !== s) return false;
    if (busy.current) {
      reloadWanted.current = true; // a write started while reading: look again once it's done
      return false;
    }
    // Unchanged since our last read/write — unless saving was frozen, then an identical folder is the all-clear.
    if (!frozen.current && fileMapsEqual(files, baseline.current)) return false;
    if (!files.has(ROOT_FILE)) {
      freeze(`${folderName(s.root)} no longer has a ${ROOT_FILE} (was the branch switched?). Changes aren't saved until it's back.`);
      return false;
    }
    try {
      cancelPendingSave(); // the disk wins over edits that weren't saved yet
      applyFolderLoad(s.root, files);
    } catch (err) {
      if (!(err instanceof WorkspaceFolderError)) throw err;
      freeze(`${err.message} Changes aren't saved until it's fixed.`);
      return false;
    }
    setSaveState("saved");
    return true;
  }, [applyFolderLoad]);

  // Watch the open folder for changes made outside the app (git pull, checkout, an editor).
  useEffect(() => {
    if (source.kind !== "folder" || !isTauri()) return;
    const root = source.root;
    let stop: (() => void) | null = null;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    watch(
      root,
      (event) => {
        const relevant = event.paths.some((p) => {
          const rel = relativeInside(root, p);
          return rel !== null && !rel.startsWith(".git/") && (isManagedPath(rel) || rel === "collections" || rel.startsWith("collections/") || rel.startsWith("environments"));
        });
        if (!relevant) return;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          void reloadFromDisk().then((changed) => {
            if (changed) toast("Workspace reloaded: files changed on disk.");
          });
        }, RELOAD_DELAY);
      },
      { recursive: true, delayMs: 200 },
    )
      .then((unwatch) => {
        if (cancelled) unwatch();
        else stop = unwatch;
      })
      .catch((err) => setError(message(err, "Couldn't watch the workspace folder for changes.")));
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      stop?.();
    };
  }, [source, reloadFromDisk]);

  // Reopen what was open last time.
  useEffect(() => {
    const s = sourceRef.current;
    if (s.kind === "file") {
      readWorkspaceFile(s.path)
        .then(adopt)
        .catch(() => {
          setSource({ kind: "cache" });
          setSaveState("cache");
          setError(`Couldn't reopen ${basename(s.path)}. It may have moved or been deleted, so your last cached copy is shown.`);
          adopt(loadCache());
        });
    } else if (s.kind === "folder") {
      const giveUp = (why: string) => {
        setSource({ kind: "cache" });
        setSaveState("cache");
        setError(`Couldn't reopen ${folderName(s.root)}: ${why}. The app's own workspace is shown instead.`);
        adopt(loadCache());
      };
      exists(s.root)
        .then(async (there) => {
          if (!there) return giveUp("the folder is gone (moved, renamed, or on a drive that isn't mounted)");
          const opened = await openWorkspaceFolder(s.root).catch((err) => err as Error);
          if (!(opened instanceof Error)) return void applyFolderLoad(s.root, opened.files);
          if (!(opened instanceof WorkspaceFolderError)) return giveUp(message(opened, "it couldn't be read"));
          // e.g. satchel.json mid-merge: stay on the folder, show the last copy, and wait for the fix (the watcher reloads).
          freeze(`${folderName(s.root)}: ${opened.message} Changes aren't saved until it's fixed.`);
        })
        .catch((err) => giveUp(message(err, "it couldn't be read")));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, []);

  /** Open a workspace folder (asks for one when `root` is omitted). */
  const openFolder = useCallback(
    async (root?: string): Promise<OpenFolderResult> => {
      setError(null);
      try {
        const picked = root ?? (await pickFolder("Open a workspace folder"));
        if (!picked) return { status: "cancelled" };
        const files = await readManagedFiles(picked);
        if (!files.has(ROOT_FILE)) return { status: "not-workspace", root: picked };
        await flush();
        const load = filesToWorkspace(files, picked); // throws on an unusable satchel.json
        setSource({ kind: "folder", root: picked });
        frozen.current = false;
        baseline.current = files;
        protectedPaths.current = load.protectedPaths;
        setProblems(load.problems);
        adopt(load.workspace);
        setSaveState("saved");
        return { status: "opened", root: picked, problems: load.problems.length };
      } catch (err) {
        const msg = message(err, "Couldn't open that folder.");
        setError(msg);
        return { status: "failed", message: msg };
      }
    },
    [adopt, flush, setSource],
  );

  /** Make `root` a workspace folder holding `from` (the current workspace, or an empty one), and switch to it. */
  const createFolderWorkspace = useCallback(
    async (root: string, from: "current" | "empty"): Promise<boolean> => {
      setError(null);
      try {
        await flush();
        const w = from === "current" ? workspaceRef.current : emptyWorkspace();
        const files = await createWorkspaceFolder(root, w);
        setSource({ kind: "folder", root });
        frozen.current = false;
        baseline.current = files;
        protectedPaths.current = [];
        setProblems([]);
        adopt(w);
        setSaveState("saved");
        return true;
      } catch (err) {
        setError(message(err, "Couldn't create the workspace folder."));
        return false;
      }
    },
    [adopt, flush, setSource],
  );

  /** Convert what's open now into a new workspace folder ("Save as folder…"). */
  const saveAsFolder = useCallback(async (): Promise<boolean> => {
    try {
      const root = await pickFolder("Choose an empty folder (or a repository) for this workspace");
      return root ? createFolderWorkspace(root, "current") : false;
    } catch (err) {
      setError(message(err, "Couldn't save as a folder."));
      return false;
    }
  }, [createFolderWorkspace]);

  /** Stop using the folder or file; back to the app's scratch workspace. */
  const closeWorkspace = useCallback(async () => {
    await flush();
    setSource({ kind: "cache" });
    baseline.current = new Map();
    protectedPaths.current = [];
    setProblems([]);
    adopt(loadCache());
    setSaveState("cache");
  }, [adopt, flush, setSource]);

  const forgetRecent = useCallback((root: string) => {
    setRecents((list) => {
      const next = withoutRecent(list, root);
      storeRecents(next);
      return next;
    });
  }, []);

  // Legacy single-file workspaces (.json)
  const openFile = useCallback(async () => {
    setError(null);
    try {
      const path = await pickOpenLocation();
      if (!path) return;
      const w = await readWorkspaceFile(path);
      await flush();
      setSource({ kind: "file", path });
      setProblems([]);
      adopt(w);
      setSaveState("saved");
    } catch (err) {
      setError(message(err, "Couldn't open that workspace file."));
    }
  }, [adopt, flush, setSource]);

  const saveFileAs = useCallback(async () => {
    setError(null);
    try {
      const path = await pickSaveLocation();
      if (!path) return;
      await flush();
      setSource({ kind: "file", path });
      setProblems([]);
      await writeNow(workspaceRef.current);
    } catch (err) {
      setError(message(err, "Couldn't save the workspace."));
    }
  }, [flush, setSource, writeNow]);

  const name = source.kind === "folder" ? folderName(source.root) : source.kind === "file" ? basename(source.path) : null;
  const path = source.kind === "folder" ? source.root : source.kind === "file" ? source.path : null;

  return {
    source,
    /** folder name or file name; null for the app cache */
    sourceName: name,
    /** folder root or file path; null for the app cache */
    sourcePath: path,
    saveState,
    error,
    clearError: () => setError(null),
    /** files in the folder that couldn't be loaded (conflicts, invalid JSON) or were fixed up */
    problems,
    recentFolders,
    forgetRecent,
    openFolder,
    createFolderWorkspace,
    saveAsFolder,
    closeWorkspace,
    reloadFromDisk,
    openFile,
    saveFileAs,
  };
}
