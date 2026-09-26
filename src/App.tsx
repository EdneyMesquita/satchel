import { useState } from "react";
import "./App.css";
import { Sidebar } from "./components/Sidebar";
import { RequestEditor } from "./components/RequestEditor";
import { parsePostmanCollection, PostmanImportError } from "./postman";
import { findRequest, updateRequestInCollections } from "./collectionTree";
import type { Collection } from "./types";

export default function App() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

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

  const selectedRequest = selectedRequestId ? findRequestAcross(collections, selectedRequestId) : undefined;
  const activeCollection = collections.find((c) => selectedRequestId && findRequest(c.items, selectedRequestId));

  return (
    <div className="shell">
      <Sidebar
        collections={collections}
        selectedRequestId={selectedRequestId}
        onSelectRequest={setSelectedRequestId}
        onImportFile={handleImportFile}
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
          Select a request, or import a Postman collection to get started.
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
