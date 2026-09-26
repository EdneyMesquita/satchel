import { useState } from "react";
import type { Environment, KeyValue } from "../types";
import { KvEditor } from "./KvEditor";

interface EnvironmentsModalProps {
  environments: Environment[];
  activeEnvironmentId: string | null;
  onClose: () => void;
  onCreate: () => string;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onSetActive: (id: string | null) => void;
  onUpdateVariables: (id: string, variables: KeyValue[]) => void;
  globals: KeyValue[];
  onUpdateGlobals: (variables: KeyValue[]) => void;
}

export function EnvironmentsModal({
  environments,
  activeEnvironmentId,
  onClose,
  onCreate,
  onRename,
  onDelete,
  onSetActive,
  onUpdateVariables,
  globals,
  onUpdateGlobals,
}: EnvironmentsModalProps) {
  const [editingId, setEditingId] = useState<string | "globals">("globals");
  const editing = editingId === "globals" ? null : environments.find((e) => e.id === editingId);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Environments</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">
          <div className="env-list">
            <div className={`env-list-row${editingId === "globals" ? " active" : ""}`} onClick={() => setEditingId("globals")}>
              <span className="env-name">Globals</span>
            </div>
            <div className="env-list-divider" />
            {environments.map((env) => (
              <div key={env.id} className={`env-list-row${env.id === editingId ? " active" : ""}`} onClick={() => setEditingId(env.id)}>
                <button
                  className={`env-dot-btn${env.id === activeEnvironmentId ? " on" : ""}`}
                  title={env.id === activeEnvironmentId ? "Active environment" : "Set as active"}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSetActive(env.id === activeEnvironmentId ? null : env.id);
                  }}
                >
                  <span className="dot" />
                </button>
                <span className="env-name">{env.name}</span>
                <button
                  className="env-delete"
                  title="Delete environment"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(env.id);
                    if (editingId === env.id) setEditingId("globals");
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className="add-row"
              onClick={() => {
                const id = onCreate();
                setEditingId(id);
              }}
            >
              + New environment
            </button>
          </div>

          <div className="env-editor">
            {editingId === "globals" ? (
              <>
                <div className="env-editor-head">
                  <span className="env-name-input" style={{ fontWeight: 600 }}>
                    Globals
                  </span>
                  <span className="active-badge">Always applied</span>
                </div>
                <p className="env-editor-hint">Available in every request, in every collection — regardless of which environment is active.</p>
                <KvEditor rows={globals} onChange={onUpdateGlobals} />
              </>
            ) : editing ? (
              <>
                <div className="env-editor-head">
                  <input className="env-name-input" value={editing.name} onChange={(e) => onRename(editing.id, e.target.value)} />
                  {editing.id === activeEnvironmentId ? (
                    <span className="active-badge">Active</span>
                  ) : (
                    <button className="btn" onClick={() => onSetActive(editing.id)}>
                      Set as active
                    </button>
                  )}
                </div>
                <KvEditor rows={editing.variables} onChange={(variables) => onUpdateVariables(editing.id, variables)} />
              </>
            ) : (
              <div className="env-empty">Select or create an environment to edit its variables.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
