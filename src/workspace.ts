import type { Collection, Environment, KeyValue, TreeNode, Workspace } from "./types";

export class WorkspaceFileError extends Error {}

export function emptyWorkspace(): Workspace {
  return { collections: [], environments: [], activeEnvironmentId: null, globals: [] };
}

function isKeyValueArray(value: unknown): value is KeyValue[] {
  return Array.isArray(value) && value.every((v) => v && typeof v.key === "string" && typeof v.value === "string");
}

function isTreeNodeArray(value: unknown): value is TreeNode[] {
  return Array.isArray(value);
}

function isCollection(value: unknown): value is Collection {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Collection;
  return typeof c.id === "string" && typeof c.name === "string" && isTreeNodeArray(c.items) && isKeyValueArray(c.variables);
}

function isEnvironment(value: unknown): value is Environment {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Environment;
  return typeof e.id === "string" && typeof e.name === "string" && isKeyValueArray(e.variables);
}

export function parseWorkspace(json: unknown): Workspace {
  if (typeof json !== "object" || json === null) {
    throw new WorkspaceFileError("This file isn't a Satchel workspace — expected a JSON object.");
  }
  const w = json as Partial<Workspace>;
  if (!Array.isArray(w.collections) || !w.collections.every(isCollection)) {
    throw new WorkspaceFileError("Missing or malformed collections[] in this workspace file.");
  }
  const environments = Array.isArray(w.environments) && w.environments.every(isEnvironment) ? w.environments : [];
  const activeEnvironmentId = typeof w.activeEnvironmentId === "string" ? w.activeEnvironmentId : null;
  const globals = isKeyValueArray(w.globals) ? w.globals : [];
  return { collections: w.collections, environments, activeEnvironmentId, globals };
}

export function serializeWorkspace(workspace: Workspace): string {
  return JSON.stringify(workspace, null, 2);
}
