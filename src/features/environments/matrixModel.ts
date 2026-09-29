import type { Environment, KeyValue, Workspace } from "@/types";
import type { VariableTarget } from "@/state/workspace";

/** One value column of the environments matrix: globals, a collection, or an environment. */
export interface MatrixColumn {
  /** "g", "c:<collectionId>", "e:<environmentId>" */
  key: string;
  label: string;
  /** Small uppercase line above the label */
  group: "Workspace" | "Collection" | "Environment";
  target: VariableTarget;
  variables: KeyValue[];
  environment?: Environment;
}

export const VARIABLE_NAME = /^[\w.-]+$/;

export const envColumnKey = (environmentId: string) => `e:${environmentId}`;
export const GLOBALS_KEY = "g";

export function matrixColumns(workspace: Workspace): MatrixColumn[] {
  return [
    { key: GLOBALS_KEY, label: "Globals", group: "Workspace", target: { scope: "globals" }, variables: workspace.globals },
    ...workspace.collections.map(
      (c): MatrixColumn => ({
        key: `c:${c.id}`,
        label: c.name,
        group: "Collection",
        target: { scope: "collection", id: c.id },
        variables: c.variables,
      }),
    ),
    ...workspace.environments.map(
      (e): MatrixColumn => ({
        key: envColumnKey(e.id),
        label: e.name,
        group: "Environment",
        target: { scope: "environment", id: e.id },
        variables: e.variables,
        environment: e,
      }),
    ),
  ];
}

/** Every variable name defined anywhere, plus `extra` names being filled in, sorted. */
export function matrixVariableNames(workspace: Workspace, extra: Iterable<string> = []): string[] {
  const names = new Set<string>(extra);
  for (const v of workspace.globals) names.add(v.key);
  for (const c of workspace.collections) for (const v of c.variables) names.add(v.key);
  for (const e of workspace.environments) for (const v of e.variables) names.add(v.key);
  names.delete("");
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function valueIn(column: MatrixColumn, name: string): string | undefined {
  return column.variables.find((v) => v.key === name)?.value;
}

/** Cell width in ch: fits the column's label and longest value, clamped to 10–34. */
export function columnWidth(column: MatrixColumn, names: string[]): number {
  const longest = Math.max(0, ...names.map((n) => (valueIn(column, n) ?? "").length + 1));
  return Math.min(34, Math.max(10, column.label.length + 2, longest));
}
