import { useEffect, useRef, useState } from "react";
import "./App.css";
import { Sidebar } from "./components/Sidebar";
import { RequestEditor } from "./components/RequestEditor";
import { parsePostmanCollection, PostmanImportError } from "./postman";
import {
  addNode,
  createCollection,
  createEnvironment,
  createFolder,
  createRequest,
  findRequest,
  removeNode,
  renameNode,
  updateRequestInCollections,
} from "./collectionTree";
import { basename, pickOpenLocation, pickSaveLocation, readWorkspaceFile, writeWorkspaceFile, FileStoreError } from "./fileStore";
import { emptyWorkspace } from "./workspace";
import { parseCurl, CurlParseError } from "./curl";
import { readClipboardText } from "./clipboard";
import type { Collection, Environment, KeyValue, Workspace } from "./types";

function nameFromUrl(url: string): string {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return u.pathname.split("/").filter(Boolean).pop() || u.hostname || "Pasted cURL";
  } catch {
    return "Pasted cURL";
  }
}

const CACHE_KEY = "satchel.workspace.cache";
const PATH_KEY = "satchel.filePath";

function loadCachedWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? { ...emptyWorkspace(), ...JSON.parse(raw) } : emptyWorkspace();
  } catch {
    return emptyWorkspace();
  }
}

export default function App() {
  const initial = useRef(loadCachedWorkspace());
  const [collections, setCollections] = useState<Collection[]>(initial.current.collections);
  const [environments, setEnvironments] = useState<Environment[]>(initial.current.environments);
  const [activeEnvironmentId, setActiveEnvironmentId] = useState<string | null>(initial.current.activeEnvironmentId);
  const [globals, setGlobals] = useState<KeyValue[]>(initial.current.globals);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string | null>(() => localStorage.getItem(PATH_KEY));
  const [banner, setBanner] = useState<string | null>(null);

  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // On first mount, if a file was open last time, load the live copy from disk.
  useEffect(() => {
    const path = localStorage.getItem(PATH_KEY);
    if (!path) return;
    readWorkspaceFile(path)
      .then((workspace) => {
        setCollections(workspace.collections);
        setEnvironments(workspace.environments);
        setActiveEnvironmentId(workspace.activeEnvironmentId);
        setGlobals(workspace.globals);
        setFilePath(path);
      })
      .catch(() => {
        localStorage.removeItem(PATH_KEY);
        setFilePath(null);
        setBanner(`Couldn't reopen ${basename(path)} — it may have moved or been deleted. Falling back to your last saved copy.`);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cache to localStorage on every change, and debounce-write to the open file if there is one.
  useEffect(() => {
    const workspace: Workspace = { collections, environments, activeEnvironmentId, globals };
    localStorage.setItem(CACHE_KEY, JSON.stringify(workspace));

    if (!filePath) return;
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(() => {
      writeWorkspaceFile(filePath, workspace).catch((err) => {
        setBanner(err instanceof Error ? err.message : "Couldn't save to the workspace file.");
      });
    }, 400);
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, [collections, environments, activeEnvironmentId, globals, filePath]);

  async function handleSaveFile() {
    setBanner(null);
    try {
      let path = filePath;
      if (!path) {
        path = await pickSaveLocation();
        if (!path) return;
        setFilePath(path);
        localStorage.setItem(PATH_KEY, path);
      }
      await writeWorkspaceFile(path, { collections, environments, activeEnvironmentId, globals });
    } catch (err) {
      setBanner(err instanceof FileStoreError || err instanceof Error ? err.message : "Couldn't save the workspace.");
    }
  }

  async function handleOpenFile() {
    setBanner(null);
    try {
      const path = await pickOpenLocation();
      if (!path) return;
      const workspace = await readWorkspaceFile(path);
      setCollections(workspace.collections);
      setEnvironments(workspace.environments);
      setActiveEnvironmentId(workspace.activeEnvironmentId);
      setGlobals(workspace.globals);
      setSelectedRequestId(null);
      setFilePath(path);
      localStorage.setItem(PATH_KEY, path);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Couldn't open that workspace file.");
    }
  }

  async function handleImportFile(file: File) {
    setBanner(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const collection = parsePostmanCollection(json);
      setCollections((prev) => [...prev, collection]);
    } catch (err) {
      setBanner(err instanceof PostmanImportError ? err.message : "Couldn't read that file as JSON.");
    }
  }

  function handleCreateCollection(): string {
    const collection = createCollection("New Collection");
    setCollections((prev) => [...prev, collection]);
    return collection.id;
  }

  function handleAddFolder(collectionId: string, parentFolderId: string | null): string {
    const folder = createFolder("New Folder");
    setCollections((prev) =>
      prev.map((c) => (c.id === collectionId ? { ...c, items: addNode(c.items, parentFolderId, folder) } : c)),
    );
    return folder.id;
  }

  function handleAddRequest(collectionId: string, parentFolderId: string | null): string {
    const node = createRequest("New Request");
    setCollections((prev) =>
      prev.map((c) => (c.id === collectionId ? { ...c, items: addNode(c.items, parentFolderId, node) } : c)),
    );
    return node.id;
  }

  // For "+ New request" with no collection selected: drop it in the first
  // collection, or create one to hold it if there isn't one yet — you
  // shouldn't need a collection to exist before you can start a request.
  function handleQuickAddRequest(): { collectionId: string; requestId: string } {
    const node = createRequest("New Request");
    if (collections.length === 0) {
      const collection = { ...createCollection("My Requests"), items: [node] };
      setCollections([collection]);
      setSelectedRequestId(node.id);
      return { collectionId: collection.id, requestId: node.id };
    }
    const targetId = collections[0].id;
    setCollections((prev) => prev.map((c, i) => (i === 0 ? { ...c, items: [...c.items, node] } : c)));
    setSelectedRequestId(node.id);
    return { collectionId: targetId, requestId: node.id };
  }

  function handleRenameCollection(collectionId: string, name: string) {
    setCollections((prev) => prev.map((c) => (c.id === collectionId ? { ...c, name } : c)));
  }

  function handleRenameNode(collectionId: string, nodeId: string, name: string) {
    setCollections((prev) =>
      prev.map((c) => (c.id === collectionId ? { ...c, items: renameNode(c.items, nodeId, name) } : c)),
    );
  }

  function handleDeleteCollection(collectionId: string) {
    const collection = collections.find((c) => c.id === collectionId);
    setCollections((prev) => prev.filter((c) => c.id !== collectionId));
    if (selectedRequestId && collection && findRequest(collection.items, selectedRequestId)) {
      setSelectedRequestId(null);
    }
  }

  function handleDeleteNode(collectionId: string, nodeId: string) {
    setCollections((prev) =>
      prev.map((c) => (c.id === collectionId ? { ...c, items: removeNode(c.items, nodeId) } : c)),
    );
    if (selectedRequestId === nodeId) setSelectedRequestId(null);
  }

  async function handlePasteCurl() {
    setBanner(null);
    let text: string;
    try {
      text = await readClipboardText();
    } catch {
      setBanner("Couldn't read the clipboard — copy a curl command first, then try again.");
      return;
    }
    let parsed;
    try {
      parsed = parseCurl(text);
    } catch (err) {
      setBanner(err instanceof CurlParseError ? err.message : "Couldn't parse that as a curl command.");
      return;
    }
    const node = createRequest(nameFromUrl(parsed.url));
    node.request.method = parsed.method;
    node.request.url = parsed.url;
    node.request.headers = parsed.headers;
    node.request.body = parsed.body;
    node.request.auth = parsed.auth;

    setCollections((prev) => {
      if (prev.length === 0) return [{ ...createCollection("cURL Imports"), items: [node] }];
      return prev.map((c, i) => (i === 0 ? { ...c, items: [...c.items, node] } : c));
    });
    setSelectedRequestId(node.id);
  }

  function handleCreateEnvironment(): string {
    const env = createEnvironment("New Environment");
    setEnvironments((prev) => [...prev, env]);
    return env.id;
  }

  function handleRenameEnvironment(id: string, name: string) {
    setEnvironments((prev) => prev.map((e) => (e.id === id ? { ...e, name } : e)));
  }

  function handleDeleteEnvironment(id: string) {
    setEnvironments((prev) => prev.filter((e) => e.id !== id));
    if (activeEnvironmentId === id) setActiveEnvironmentId(null);
  }

  function handleUpdateEnvironmentVariables(id: string, variables: KeyValue[]) {
    setEnvironments((prev) => prev.map((e) => (e.id === id ? { ...e, variables } : e)));
  }

  const selectedRequest = selectedRequestId ? findRequestAcross(collections, selectedRequestId) : undefined;
  const activeCollection = collections.find((c) => selectedRequestId && findRequest(c.items, selectedRequestId));
  const activeEnvironment = environments.find((e) => e.id === activeEnvironmentId);
  // Precedence, highest first: active environment > collection > globals.
  const mergedVariables: KeyValue[] = [...(activeEnvironment?.variables ?? []), ...(activeCollection?.variables ?? []), ...globals];

  return (
    <div className="shell">
      <Sidebar
        collections={collections}
        selectedRequestId={selectedRequestId}
        onSelectRequest={setSelectedRequestId}
        onImportFile={handleImportFile}
        onPasteCurl={handlePasteCurl}
        onCreateCollection={handleCreateCollection}
        onAddFolder={handleAddFolder}
        onAddRequest={handleAddRequest}
        onQuickAddRequest={handleQuickAddRequest}
        onRenameCollection={handleRenameCollection}
        onRenameNode={handleRenameNode}
        onDeleteCollection={handleDeleteCollection}
        onDeleteNode={handleDeleteNode}
        environments={environments}
        activeEnvironmentId={activeEnvironmentId}
        onSetActiveEnvironment={setActiveEnvironmentId}
        onCreateEnvironment={handleCreateEnvironment}
        onRenameEnvironment={handleRenameEnvironment}
        onDeleteEnvironment={handleDeleteEnvironment}
        onUpdateEnvironmentVariables={handleUpdateEnvironmentVariables}
        globals={globals}
        onUpdateGlobals={setGlobals}
        fileName={filePath ? basename(filePath) : null}
        onSaveFile={handleSaveFile}
        onOpenFile={handleOpenFile}
      />
      {banner && (
        <div style={{ position: "fixed", bottom: 16, left: 16, background: "var(--del)", color: "white", padding: "10px 14px", borderRadius: 8, fontSize: 12.5, maxWidth: 340, zIndex: 200 }}>
          {banner}
        </div>
      )}
      {selectedRequest ? (
        <RequestEditor
          key={selectedRequest.id}
          request={selectedRequest}
          variables={mergedVariables}
          onChange={(updater) =>
            setCollections((prev) => updateRequestInCollections(prev, selectedRequest.id, updater))
          }
        />
      ) : (
        <div className="main" style={{ alignItems: "center", justifyContent: "center", display: "flex", color: "var(--ink-faint)" }}>
          Create a request, or import a Postman collection to get started.
        </div>
      )}
    </div>
  );
}

function findRequestAcross(collections: Collection[], id: string) {
  for (const collection of collections) {
    const found = findRequest(collection.items, id);
    if (found) return found;
  }
  return undefined;
}
