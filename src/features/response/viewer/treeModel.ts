import { childId, type JsonPath, type PathSegment } from "./jsonPath";

/** How many children a container shows before a "Show more" row. */
export const CHUNK = 100;
/** Above this many nodes, the default expansion is shallower. */
export const LARGE_DOC_NODES = 2000;
/** The default expansion stops adding levels once this many rows would be visible. */
export const DEFAULT_ROW_BUDGET = 1000;

export type Container = unknown[] | Record<string, unknown>;

export function isContainer(v: unknown): v is Container {
  return v !== null && typeof v === "object";
}

/** Number of direct children. */
export function sizeOf(v: Container): number {
  return Array.isArray(v) ? v.length : Object.keys(v).length;
}

/** Child segments in display order. */
export function childSegments(v: Container): PathSegment[] {
  return Array.isArray(v) ? v.map((_, i) => i) : Object.keys(v);
}

/** Count nodes (root included), stopping early once `cap` is exceeded. */
export function countNodes(root: unknown, cap = Infinity): number {
  let count = 0;
  const stack: unknown[] = [root];
  while (stack.length) {
    const v = stack.pop();
    if (++count > cap) return count;
    if (Array.isArray(v)) for (let i = v.length - 1; i >= 0; i--) stack.push(v[i]);
    else if (isContainer(v)) for (const k in v) stack.push((v as Record<string, unknown>)[k]);
  }
  return count;
}

/** Rows a container contributes when expanded: its visible children plus a "more" row. */
function expandedRowCount(v: Container, limit = CHUNK): number {
  const n = sizeOf(v);
  return Math.min(n, limit) + (n > limit ? 1 : 0);
}

/**
 * Container ids expanded on first show: every container down to depth 2 (root = 0), or depth 1
 * for documents over LARGE_DOC_NODES nodes. A level is only added while the visible row count
 * stays within `budget`, so a long array of objects opens as a list rather than a wall.
 */
export function defaultExpanded(root: unknown, budget = DEFAULT_ROW_BUDGET): Set<string> {
  const expanded = new Set<string>();
  if (!isContainer(root)) return expanded;
  const maxDepth = countNodes(root, LARGE_DOC_NODES) > LARGE_DOC_NODES ? 1 : 2;

  expanded.add("");
  let rows = expandedRowCount(root);
  let level: { id: string; value: Container }[] = [{ id: "", value: root }];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next: { id: string; value: Container }[] = [];
    let added = 0;
    for (const { id, value } of level) {
      const segs = childSegments(value).slice(0, CHUNK);
      for (const seg of segs) {
        const child = (value as Record<string | number, unknown>)[seg];
        if (isContainer(child) && sizeOf(child) > 0) {
          next.push({ id: childId(id, seg), value: child });
          added += expandedRowCount(child);
        }
      }
    }
    if (!next.length || rows + added > budget) break;
    for (const n of next) expanded.add(n.id);
    rows += added;
    level = next;
  }
  return expanded;
}

/** Every non-empty container id, for "Expand all". */
export function allContainerIds(root: unknown): Set<string> {
  const out = new Set<string>();
  const stack: { id: string; value: unknown }[] = [{ id: "", value: root }];
  while (stack.length) {
    const { id, value } = stack.pop()!;
    if (!isContainer(value) || sizeOf(value) === 0) continue;
    out.add(id);
    for (const seg of childSegments(value)) stack.push({ id: childId(id, seg), value: (value as Record<string | number, unknown>)[seg] });
  }
  return out;
}

export interface NodeRow {
  kind: "node";
  id: string;
  path: JsonPath;
  /** 0 for the root's children */
  depth: number;
  /** null only for a primitive root */
  segment: PathSegment | null;
  value: unknown;
  container: boolean;
  /** number of children (containers only) */
  size: number;
  expanded: boolean;
}

export interface MoreRow {
  kind: "more";
  id: string;
  parentId: string;
  depth: number;
  /** children not shown yet */
  remaining: number;
}

export type TreeRow = NodeRow | MoreRow;

/**
 * Visible rows, in document order. The root itself has no row (a primitive root is one
 * keyless row). Each container shows `limits.get(id) ?? CHUNK` children.
 */
export function flattenRows(root: unknown, expanded: ReadonlySet<string>, limits: ReadonlyMap<string, number> = new Map()): TreeRow[] {
  const rows: TreeRow[] = [];
  if (!isContainer(root)) {
    rows.push({ kind: "node", id: "", path: [], depth: 0, segment: null, value: root, container: false, size: 0, expanded: false });
    return rows;
  }
  const walk = (value: Container, id: string, path: JsonPath, depth: number) => {
    const segs = childSegments(value);
    const limit = limits.get(id) ?? CHUNK;
    const shown = Math.min(segs.length, limit);
    for (let i = 0; i < shown; i++) {
      const seg = segs[i];
      const child = (value as Record<string | number, unknown>)[seg];
      const cid = childId(id, seg);
      const cpath = [...path, seg];
      const container = isContainer(child);
      const size = container ? sizeOf(child) : 0;
      const open = container && size > 0 && expanded.has(cid);
      rows.push({ kind: "node", id: cid, path: cpath, depth, segment: seg, value: child, container, size, expanded: open });
      if (open) walk(child as Container, cid, cpath, depth + 1);
    }
    if (segs.length > shown) rows.push({ kind: "more", id: `${id}#more`, parentId: id, depth, remaining: segs.length - shown });
  };
  walk(root, "", [], 0);
  return rows;
}

/**
 * What it takes to make `path` visible: ancestor ids to expand, and container limits to raise
 * where the path goes past the first chunk. Mutates and returns the given copies.
 */
export function reveal(
  root: unknown,
  path: readonly PathSegment[],
  expanded: Set<string>,
  limits: Map<string, number>,
): { expanded: Set<string>; limits: Map<string, number> } {
  let node: unknown = root;
  let id = "";
  for (const seg of path) {
    if (!isContainer(node)) break;
    expanded.add(id);
    const index = Array.isArray(node) ? (seg as number) : Object.keys(node).indexOf(seg as string);
    const limit = limits.get(id) ?? CHUNK;
    if (index >= limit) limits.set(id, Math.ceil((index + 1) / CHUNK) * CHUNK);
    node = (node as Record<string | number, unknown>)[seg];
    id = childId(id, seg);
  }
  return { expanded, limits };
}

/** Id of the parent node (the root's children have parent ""). */
export function parentIdOf(rows: readonly TreeRow[], index: number): string | null {
  const row = rows[index];
  if (!row || row.kind !== "node" || row.path.length <= 1) return null;
  for (let i = index - 1; i >= 0; i--) {
    const r = rows[i];
    if (r.kind === "node" && r.depth === row.depth - 1) return r.id;
  }
  return null;
}

/** Short summary for a container: `3 keys`, `1 item`. */
export function summarize(value: Container, size = sizeOf(value)): string {
  if (Array.isArray(value)) return `${size} ${size === 1 ? "item" : "items"}`;
  return `${size} ${size === 1 ? "key" : "keys"}`;
}
