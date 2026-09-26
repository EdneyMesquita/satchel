import { useEffect, useState } from "react";
import "./App.css";
import { Sidebar } from "./components/Sidebar";
import { RequestEditor } from "./components/RequestEditor";
import { parsePostmanCollection, PostmanImportError } from "./postman";
import {
  addNode,
  createCollection,
  createFolder,
  createRequest,
  findRequest,
  removeNode,
  renameNode,
  updateRequestInCollections,
} from "./collectionTree";
import type { Collection } from "./types";

const STORAGE_KEY = "satchel.collections";

function loadCollections(): Collection[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Collection[]) : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [collections, setCollections] = useState<Collection[]>(loadCollections);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(collections));
  }, [collections]);

  async function handleImportFile(file: File) {
    setImportError(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const collection = parsePostmanCollection(json);
      setCollections((prev) => [...prev, collection]);
    } catch (err) {
      setImportError(err instanceof PostmanImportError ? err.message : "Couldn't read that file as JSON.");
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

  function handleRenameCollection(collectionId: string, name: string) {
    setCollections((prev) => prev.map((c) => (c.id === collectionId ? { ...c, name } : c)));
  }

  function handleRenameNode(collectionId: string, nodeId: string, name: string) {
    setCollections((prev) =>
      prev.map((c) => (c.id === collectionId ? { ...c, items: renameNode(c.items, nodeId, name) } : c)),
    );
  }

  function handleDeleteCollection(collectionId: string) {
    setCollections((prev) => prev.filter((c) => c.id !== collectionId));
    if (selectedRequestId && findRequest(collections.find((c) => c.id === collectionId)?.items ?? [], selectedRequestId)) {
      setSelectedRequestId(null);
    }
  }

  function handleDeleteNode(collectionId: string, nodeId: string) {
    setCollections((prev) =>
      prev.map((c) => (c.id === collectionId ? { ...c, items: removeNode(c.items, nodeId) } : c)),
    );
    if (selectedRequestId === nodeId) setSelectedRequestId(null);
  }

  const selectedRequest = selectedRequestId ? findRequestAcross(collections, selectedRequestId) : undefined;
  const activeCollection = collections.find((c) => selectedRequestId && findRequest(c.items, selectedRequestId));

  return (
    <div className="shell">
      <Sidebar
        collections={collections}
        selectedRequestId={selectedRequestId}
        onSelectRequest={setSelectedRequestId}
        onImportFile={handleImportFile}
        onCreateCollection={handleCreateCollection}
        onAddFolder={handleAddFolder}
        onAddRequest={handleAddRequest}
        onRenameCollection={handleRenameCollection}
        onRenameNode={handleRenameNode}
        onDeleteCollection={handleDeleteCollection}
        onDeleteNode={handleDeleteNode}
      />
      {importError && (
        <div style={{ position: "fixed", bottom: 16, left: 16, background: "var(--del)", color: "white", padding: "10px 14px", borderRadius: 8, fontSize: 12.5, maxWidth: 320 }}>
          {importError}
        </div>
      )}
      {selectedRequest ? (
        <RequestEditor
          key={selectedRequest.id}
          request={selectedRequest}
          variables={activeCollection?.variables ?? []}
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
