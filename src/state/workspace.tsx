import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Collection, Environment, FolderNode, KeyValue, SatchelRequest, TreeNode, Workspace } from "@/types";
import {
  addNode,
  createCollection,
  createFolder,
  createRequest,
  findRequest,
  removeNode,
  renameNode,
  updateRequestInCollections,
} from "@/collectionTree";
import { basename, pickOpenLocation, pickSaveLocation, readWorkspaceFile, writeWorkspaceFile } from "@/fileStore";
import { emptyWorkspace, parseWorkspace } from "@/workspace";
import { normalizeRequest } from "@/url";
import { setVariable, type VariableContext } from "@/variables";

/**
 * The persisted document: collections, environments, globals, active env.
 * Everything here ends up in the user's .json workspace file (debounced),
 * and in a localStorage cache before a file has been chosen.
 */

const CACHE_KEY = "satchel.workspace.cache";
const PATH_KEY = "satchel.filePath";

export type SaveState = "saved" | "saving" | "cache" | "error";

export const ENV_SWATCHES = [
  "var(--ok)",
  "var(--m-get)",
  "var(--m-put)",
  "var(--m-patch)",
  "var(--m-query)",
  "var(--j-n)",
  "var(--err)",
  "var(--fg3)",
];

export interface RequestLocation {
  request: SatchelRequest;
  collection: Collection;
}

export interface NewEnvironmentInput {
  name: string;
  color: string;
  /** Environment id to copy variables from */
  copyFromId?: string;
  activate?: boolean;
}

export type VariableTarget = { scope: "globals" } | { scope: "collection"; id: string } | { scope: "environment"; id: string };

interface WorkspaceValue {
  workspace: Workspace;
  filePath: string | null;
  fileName: string | null;
  saveState: SaveState;
  /** Last file/IO error, for a banner/toast */
  error: string | null;
  clearError: () => void;

  activeEnvironment: Environment | undefined;
  findRequest: (requestId: string) => RequestLocation | undefined;
  variableContext: (requestId: string | null) => VariableContext;

  // requests & tree
  updateRequest: (requestId: string, updater: (r: SatchelRequest) => SatchelRequest) => void;
  /** Adds a request (to the first collection when collectionId is null, creating one if needed). Returns its id. */
  addRequest: (collectionId: string | null, parentFolderId?: string | null, init?: Partial<SatchelRequest>) => string;
  addFolder: (collectionId: string, parentFolderId?: string | null) => string;
  addCollection: (name?: string) => string;
  /** Append an already-built collection (Postman import). */
  importCollection: (collection: Collection) => void;
  /** Append a folder with the given items to an existing collection, merging missing collection variables. */
  importIntoCollection: (collectionId: string, folder: FolderNode, variables: KeyValue[]) => void;
  renameCollection: (collectionId: string, name: string) => void;
  renameNode: (collectionId: string, nodeId: string, name: string) => void;
  deleteCollection: (collectionId: string) => void;
  deleteNode: (collectionId: string, nodeId: string) => void;

  // environments & variables
  setActiveEnvironment: (environmentId: string | null) => void;
  createEnvironment: (input: NewEnvironmentInput) => Environment;
  /** Add environments as-is (Postman environment files). Names are de-duplicated. */
  addEnvironments: (environments: Environment[]) => Environment[];
  updateEnvironment: (environmentId: string, patch: Partial<Pick<Environment, "name" | "color">>) => void;
  /** Removes it and returns a function that restores it (for an Undo toast). */
  deleteEnvironment: (environmentId: string) => () => void;
  /** value === null removes the variable from that scope */
  setVariableIn: (target: VariableTarget, key: string, value: string | null) => void;

  // file
  saveFile: () => Promise<void>;
  saveFileAs: () => Promise<void>;
  openFile: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

function loadCachedWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? parseWorkspace({ ...emptyWorkspace(), ...JSON.parse(raw) }) : emptyWorkspace();
  } catch {
    return emptyWorkspace();
  }
}

function uniqueName(name: string, taken: string[]): string {
  let candidate = name;
  let n = 2;
  const lower = taken.map((t) => t.toLowerCase());
  while (lower.includes(candidate.toLowerCase())) candidate = `${name} ${n++}`;
  return candidate;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspace, setWorkspace] = useState<Workspace>(loadCachedWorkspace);
  const [filePath, setFilePath] = useState<string | null>(() => localStorage.getItem(PATH_KEY));
  const [saveState, setSaveState] = useState<SaveState>(() => (localStorage.getItem(PATH_KEY) ? "saved" : "cache"));
  const [error, setError] = useState<string | null>(null);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextWrite = useRef(false);

  // Reopen the file that was open last time.
  useEffect(() => {
    const path = localStorage.getItem(PATH_KEY);
    if (!path) return;
    readWorkspaceFile(path)
      .then((w) => {
        skipNextWrite.current = true;
        setWorkspace(w);
      })
      .catch(() => {
        localStorage.removeItem(PATH_KEY);
        setFilePath(null);
        setSaveState("cache");
        setError(`Couldn't reopen ${basename(path)}. It may have moved or been deleted, so your last cached copy is shown.`);
      });
  }, []);

  // Cache every change; debounce-write to the file when one is open.
  useEffect(() => {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(workspace));
    } catch {
      // storage full/unavailable — the file (if any) is still the real copy
    }
    if (!filePath) return;
    if (skipNextWrite.current) {
      skipNextWrite.current = false;
      return;
    }
    setSaveState("saving");
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      writeWorkspaceFile(filePath, workspace)
        .then(() => setSaveState("saved"))
        .catch((err) => {
          setSaveState("error");
          setError(err instanceof Error ? err.message : "Couldn't save to the workspace file.");
        });
    }, 400);
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, [workspace, filePath]);

  const setCollections = useCallback(
    (fn: (c: Collection[]) => Collection[]) => setWorkspace((w) => ({ ...w, collections: fn(w.collections) })),
    [],
  );
  const setEnvironments = useCallback(
    (fn: (e: Environment[]) => Environment[]) => setWorkspace((w) => ({ ...w, environments: fn(w.environments) })),
    [],
  );

  const locate = useCallback(
    (requestId: string): RequestLocation | undefined => {
      for (const collection of workspace.collections) {
        const request = findRequest(collection.items, requestId);
        if (request) return { request, collection };
      }
      return undefined;
    },
    [workspace.collections],
  );

  const activeEnvironment = workspace.environments.find((e) => e.id === workspace.activeEnvironmentId);

  const variableContext = useCallback(
    (requestId: string | null): VariableContext => ({
      environment: activeEnvironment,
      collection: requestId ? locate(requestId)?.collection : undefined,
      globals: workspace.globals,
    }),
    [activeEnvironment, locate, workspace.globals],
  );

  const addRequest = useCallback(
    (collectionId: string | null, parentFolderId: string | null = null, init?: Partial<SatchelRequest>) => {
      const node = createRequest(init?.name ?? "New request");
      node.request = normalizeRequest({ ...node.request, ...init, id: node.id });
      setCollections((cols) => {
        if (cols.length === 0) return [{ ...createCollection("My requests"), items: [node] }];
        const target = collectionId ?? cols[0].id;
        return cols.map((c) => (c.id === target ? { ...c, items: addNode(c.items, parentFolderId, node) } : c));
      });
      return node.id;
    },
    [setCollections],
  );

  const value: WorkspaceValue = {
    workspace,
    filePath,
    fileName: filePath ? basename(filePath) : null,
    saveState,
    error,
    clearError: () => setError(null),
    activeEnvironment,
    findRequest: locate,
    variableContext,

    updateRequest: (requestId, updater) => setCollections((cols) => updateRequestInCollections(cols, requestId, updater)),
    addRequest,
    addFolder: (collectionId, parentFolderId = null) => {
      const folder = createFolder("New folder");
      setCollections((cols) => cols.map((c) => (c.id === collectionId ? { ...c, items: addNode(c.items, parentFolderId, folder) } : c)));
      return folder.id;
    },
    addCollection: (name = "New collection") => {
      const collection = createCollection(name);
      setCollections((cols) => [...cols, collection]);
      return collection.id;
    },
    importCollection: (collection) => setCollections((cols) => [...cols, collection]),
    importIntoCollection: (collectionId, folder, variables) =>
      setCollections((cols) =>
        cols.map((c) => {
          if (c.id !== collectionId) return c;
          const missing = variables.filter((v) => !c.variables.some((cv) => cv.key === v.key));
          return { ...c, variables: [...c.variables, ...missing], items: [...c.items, folder] };
        }),
      ),
    renameCollection: (collectionId, name) => setCollections((cols) => cols.map((c) => (c.id === collectionId ? { ...c, name } : c))),
    renameNode: (collectionId, nodeId, name) =>
      setCollections((cols) => cols.map((c) => (c.id === collectionId ? { ...c, items: renameNode(c.items, nodeId, name) } : c))),
    deleteCollection: (collectionId) => setCollections((cols) => cols.filter((c) => c.id !== collectionId)),
    deleteNode: (collectionId, nodeId) =>
      setCollections((cols) => cols.map((c) => (c.id === collectionId ? { ...c, items: removeNode(c.items, nodeId) } : c))),

    setActiveEnvironment: (environmentId) => setWorkspace((w) => ({ ...w, activeEnvironmentId: environmentId })),
    createEnvironment: ({ name, color, copyFromId, activate }) => {
      const source = workspace.environments.find((e) => e.id === copyFromId);
      const env: Environment = {
        id: crypto.randomUUID(),
        name,
        color,
        variables: source ? source.variables.map((v) => ({ ...v })) : [],
      };
      setWorkspace((w) => ({
        ...w,
        environments: [...w.environments, env],
        activeEnvironmentId: activate ? env.id : w.activeEnvironmentId,
      }));
      return env;
    },
    addEnvironments: (envs) => {
      const taken = workspace.environments.map((e) => e.name);
      const added = envs.map((e, i) => {
        const name = uniqueName(e.name, taken);
        taken.push(name);
        return { ...e, name, color: e.color ?? ENV_SWATCHES[(workspace.environments.length + i + 1) % ENV_SWATCHES.length] };
      });
      setEnvironments((list) => [...list, ...added]);
      return added;
    },
    updateEnvironment: (environmentId, patch) => setEnvironments((list) => list.map((e) => (e.id === environmentId ? { ...e, ...patch } : e))),
    deleteEnvironment: (environmentId) => {
      const index = workspace.environments.findIndex((e) => e.id === environmentId);
      const env = workspace.environments[index];
      const wasActive = workspace.activeEnvironmentId === environmentId;
      setWorkspace((w) => {
        const environments = w.environments.filter((e) => e.id !== environmentId);
        return {
          ...w,
          environments,
          activeEnvironmentId: w.activeEnvironmentId === environmentId ? (environments[0]?.id ?? null) : w.activeEnvironmentId,
        };
      });
      return () => {
        if (!env) return;
        setWorkspace((w) => {
          const environments = [...w.environments];
          environments.splice(index, 0, env);
          return { ...w, environments, activeEnvironmentId: wasActive ? env.id : w.activeEnvironmentId };
        });
      };
    },
    setVariableIn: (target, key, value) =>
      setWorkspace((w) => {
        if (target.scope === "globals") return { ...w, globals: setVariable(w.globals, key, value) };
        if (target.scope === "collection")
          return { ...w, collections: w.collections.map((c) => (c.id === target.id ? { ...c, variables: setVariable(c.variables, key, value) } : c)) };
        return {
          ...w,
          environments: w.environments.map((e) => (e.id === target.id ? { ...e, variables: setVariable(e.variables, key, value) } : e)),
        };
      }),

    saveFile: async () => {
      setError(null);
      try {
        let path = filePath;
        if (!path) {
          path = await pickSaveLocation();
          if (!path) return;
          localStorage.setItem(PATH_KEY, path);
          setFilePath(path);
        }
        setSaveState("saving");
        await writeWorkspaceFile(path, workspace);
        setSaveState("saved");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save the workspace.");
      }
    },
    saveFileAs: async () => {
      setError(null);
      try {
        const path = await pickSaveLocation();
        if (!path) return;
        localStorage.setItem(PATH_KEY, path);
        setFilePath(path);
        setSaveState("saving");
        await writeWorkspaceFile(path, workspace);
        setSaveState("saved");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't save the workspace.");
      }
    },
    openFile: async () => {
      setError(null);
      try {
        const path = await pickOpenLocation();
        if (!path) return;
        const w = await readWorkspaceFile(path);
        skipNextWrite.current = true;
        setWorkspace(w);
        localStorage.setItem(PATH_KEY, path);
        setFilePath(path);
        setSaveState("saved");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't open that workspace file.");
      }
    },
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside <WorkspaceProvider>");
  return ctx;
}

/** Depth-first first request id under a node list (to open after an import). */
export function firstRequestId(items: TreeNode[]): string | undefined {
  for (const n of items) {
    if (n.type === "request") return n.id;
    const found = firstRequestId(n.children);
    if (found) return found;
  }
  return undefined;
}
