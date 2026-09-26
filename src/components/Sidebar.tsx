import { useRef } from "react";
import type { Collection, TreeNode } from "../types";

interface SidebarProps {
  collections: Collection[];
  selectedRequestId: string | null;
  onSelectRequest: (requestId: string) => void;
  onImportFile: (file: File) => void;
}

function methodClass(method: string): string {
  return method.toLowerCase();
}

function TreeNodeView({
  node,
  depth,
  selectedRequestId,
  onSelectRequest,
}: {
  node: TreeNode;
  depth: number;
  selectedRequestId: string | null;
  onSelectRequest: (id: string) => void;
}) {
  if (node.type === "folder") {
    return (
      <>
        <div className="tree-folder" style={{ paddingLeft: 6 + depth * 14 }}>
          {node.name}
        </div>
        {node.children.map((child) => (
          <TreeNodeView
            key={child.id}
            node={child}
            depth={depth + 1}
            selectedRequestId={selectedRequestId}
            onSelectRequest={onSelectRequest}
          />
        ))}
      </>
    );
  }

  const active = node.id === selectedRequestId;
  return (
    <div
      className={`tree-req${active ? " active" : ""}`}
      style={{ paddingLeft: 6 + depth * 14 }}
      onClick={() => onSelectRequest(node.id)}
    >
      <span className={`method-tag ${methodClass(node.request.method)}`}>
        {node.request.method.slice(0, 4)}
      </span>
      <span className="path">{node.request.name}</span>
    </div>
  );
}

export function Sidebar({ collections, selectedRequestId, onSelectRequest, onImportFile }: SidebarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <aside className="sidebar">
      <div className="brand">
        <svg width="20" height="20" viewBox="0 0 64 64" fill="none">
          <rect x="9" y="24" width="46" height="34" rx="8" fill="currentColor" />
          <path d="M14 26C14 20.4772 18.4772 16 24 16H40C45.5228 16 50 20.4772 50 26V27H14V26Z" fill="currentColor" opacity="0.6" />
        </svg>
        Satchel
      </div>

      <button className="import-btn" onClick={() => fileInputRef.current?.click()}>
        Import Postman collection
      </button>
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
          No collections yet. Import a Postman export to get started.
        </div>
      ) : (
        <div className="tree">
          {collections.map((collection) => (
            <div key={collection.id}>
              <div className="tree-collection">
                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M1 4a1 1 0 0 1 1-1h4l1.5 2H14a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V4z" />
                </svg>
                {collection.name}
              </div>
              {collection.items.map((node) => (
                <TreeNodeView
                  key={node.id}
                  node={node}
                  depth={1}
                  selectedRequestId={selectedRequestId}
                  onSelectRequest={onSelectRequest}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}
