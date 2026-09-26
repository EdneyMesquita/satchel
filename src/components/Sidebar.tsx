import { useRef, useState } from "react";
import type { Collection, TreeNode } from "../types";

interface SidebarProps {
  collections: Collection[];
  selectedRequestId: string | null;
  onSelectRequest: (requestId: string) => void;
  onImportFile: (file: File) => void;
  onCreateCollection: () => string;
  onAddFolder: (collectionId: string, parentFolderId: string | null) => string;
  onAddRequest: (collectionId: string, parentFolderId: string | null) => string;
  onRenameCollection: (collectionId: string, name: string) => void;
  onRenameNode: (collectionId: string, nodeId: string, name: string) => void;
  onDeleteCollection: (collectionId: string) => void;
  onDeleteNode: (collectionId: string, nodeId: string) => void;
}

type Renaming = { kind: "collection"; id: string; value: string } | { kind: "node"; collectionId: string; id: string; value: string };

function methodClass(method: string): string {
  return method.toLowerCase();
}

function PlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M8 2.5v11M2.5 8h11" />
    </svg>
  );
}
function FolderPlusIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <path d="M1.5 4a1 1 0 0 1 1-1h3l1.2 1.6h6.8a1 1 0 0 1 1 1v6.9a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1V4z" />
      <path d="M8 7.5v3.4M6.3 9.2h3.4" />
    </svg>
  );
}
function TrashIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 4.2h11M6 4.2V2.8a.8.8 0 0 1 .8-.8h2.4a.8.8 0 0 1 .8.8v1.4M6.4 7v4.6M9.6 7v4.6M3.6 4.2l.6 8.4a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9l.6-8.4" />
    </svg>
  );
}

export function Sidebar({
  collections,
  selectedRequestId,
  onSelectRequest,
  onImportFile,
  onCreateCollection,
  onAddFolder,
  onAddRequest,
  onRenameCollection,
  onRenameNode,
  onDeleteCollection,
  onDeleteNode,
}: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [renaming, setRenaming] = useState<Renaming | null>(null);

  const commitRename = () => {
    if (!renaming || !renaming.value.trim()) {
      setRenaming(null);
      return;
    }
    if (renaming.kind === "collection") onRenameCollection(renaming.id, renaming.value.trim());
    else onRenameNode(renaming.collectionId, renaming.id, renaming.value.trim());
    setRenaming(null);
  };

  const renameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commitRename();
    if (e.key === "Escape") setRenaming(null);
  };

  const handleAddRequest = (collectionId: string, parentFolderId: string | null) => {
    const id = onAddRequest(collectionId, parentFolderId);
    onSelectRequest(id);
    setRenaming({ kind: "node", collectionId, id, value: "New Request" });
  };

  const editable = (props: { value: string; onChange: (v: string) => void }) => (
    <input
      className="rename-input"
      autoFocus
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      onBlur={commitRename}
      onKeyDown={renameKeyDown}
      onClick={(e) => e.stopPropagation()}
    />
  );

  function renderNode(node: TreeNode, collectionId: string, depth: number) {
    const isRenaming = renaming?.kind === "node" && renaming.id === node.id;

    if (node.type === "folder") {
      return (
        <div key={node.id}>
          <div className="tree-folder-row" style={{ paddingLeft: 6 + depth * 14 }}>
            {isRenaming ? (
              editable({ value: renaming.value, onChange: (v) => setRenaming({ ...renaming, value: v }) })
            ) : (
              <span className="tree-folder" onDoubleClick={() => setRenaming({ kind: "node", collectionId, id: node.id, value: node.name })}>
                {node.name}
              </span>
            )}
            <div className="row-actions">
              <button title="Add request" onClick={() => handleAddRequest(collectionId, node.id)}>
                <PlusIcon />
              </button>
              <button title="Add folder" onClick={() => setRenaming({ kind: "node", collectionId, id: onAddFolder(collectionId, node.id), value: "New Folder" })}>
                <FolderPlusIcon />
              </button>
              <button title="Delete folder" onClick={() => onDeleteNode(collectionId, node.id)}>
                <TrashIcon />
              </button>
            </div>
          </div>
          {node.children.map((child) => renderNode(child, collectionId, depth + 1))}
        </div>
      );
    }

    const active = node.id === selectedRequestId;
    return (
      <div
        key={node.id}
        className={`tree-req${active ? " active" : ""}`}
        style={{ paddingLeft: 6 + depth * 14 }}
        onClick={() => onSelectRequest(node.id)}
      >
        <span className={`method-tag ${methodClass(node.request.method)}`}>{node.request.method.slice(0, 4)}</span>
        {isRenaming ? (
          editable({ value: renaming.value, onChange: (v) => setRenaming({ ...renaming, value: v }) })
        ) : (
          <span className="path" onDoubleClick={(e) => { e.stopPropagation(); setRenaming({ kind: "node", collectionId, id: node.id, value: node.request.name }); }}>
            {node.request.name}
          </span>
        )}
        <button className="row-actions single" title="Delete request" onClick={(e) => { e.stopPropagation(); onDeleteNode(collectionId, node.id); }}>
          <TrashIcon />
        </button>
      </div>
    );
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
          <rect x="9" y="24" width="46" height="34" rx="8" fill="currentColor" />
          <path d="M14 26C14 20.4772 18.4772 16 24 16H40C45.5228 16 50 20.4772 50 26V27H14V26Z" fill="currentColor" opacity="0.6" />
        </svg>
        Satchel
      </div>

      <div className="sidebar-actions">
        <button
          className="new-btn"
          onClick={() => {
            const id = onCreateCollection();
            setRenaming({ kind: "collection", id, value: "New Collection" });
          }}
        >
          + New collection
        </button>
        <button className="import-btn" onClick={() => fileInputRef.current?.click()}>
          Import Postman
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        style={{ display: "none" }}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImportFile(file);
          event.target.value = "";
        }}
      />

      {collections.length === 0 ? (
        <div className="empty-state">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          Start a new collection, or import a Postman export.
        </div>
      ) : (
        <div className="tree">
          {collections.map((collection) => {
            const isRenamingCollection = renaming?.kind === "collection" && renaming.id === collection.id;
            return (
              <div key={collection.id}>
                <div className="tree-collection">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1 4a1 1 0 0 1 1-1h4l1.5 2H14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4z" />
                  </svg>
                  {isRenamingCollection ? (
                    editable({ value: renaming.value, onChange: (v) => setRenaming({ ...renaming, value: v }) })
                  ) : (
                    <span onDoubleClick={() => setRenaming({ kind: "collection", id: collection.id, value: collection.name })}>{collection.name}</span>
                  )}
                  <div className="row-actions">
                    <button title="Add request" onClick={() => handleAddRequest(collection.id, null)}>
                      <PlusIcon />
                    </button>
                    <button
                      title="Add folder"
                      onClick={() => setRenaming({ kind: "node", collectionId: collection.id, id: onAddFolder(collection.id, null), value: "New Folder" })}
                    >
                      <FolderPlusIcon />
                    </button>
                    <button title="Delete collection" onClick={() => onDeleteCollection(collection.id)}>
                      <TrashIcon />
                    </button>
                  </div>
                </div>
                {collection.items.map((node) => renderNode(node, collection.id, 1))}
              </div>
            );
          })}
        </div>
      )}
    </aside>
  );
}
