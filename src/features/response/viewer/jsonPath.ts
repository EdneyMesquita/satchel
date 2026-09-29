/** A location inside a parsed JSON document: object keys are strings, array indices numbers. */
export type PathSegment = string | number;
export type JsonPath = PathSegment[];

const IDENT = /^[A-Za-z_$][\w$]*$/;

/** One segment as it appears in a formatted path; `first` drops the leading dot. */
export function formatSegment(segment: PathSegment, first: boolean): string {
  if (typeof segment === "number") return `[${segment}]`;
  if (IDENT.test(segment)) return first ? segment : `.${segment}`;
  return `[${JSON.stringify(segment)}]`;
}

/**
 * `data[0].tags[1]`, `meta["content-type"]`, `[3].id`. The root is "".
 * Injective, so it doubles as a stable node id in the tree.
 */
export function formatPath(path: readonly PathSegment[]): string {
  let out = "";
  for (let i = 0; i < path.length; i++) out += formatSegment(path[i], i === 0);
  return out;
}

/** Child id from its parent's id, without re-formatting the whole path. */
export function childId(parentId: string, segment: PathSegment): string {
  return parentId + formatSegment(segment, parentId === "");
}

/** Path for display: the root shows as `$`. */
export function displayPath(path: readonly PathSegment[]): string {
  return path.length ? formatPath(path) : "$";
}

/**
 * Does the query read as a path rather than free text? `$…`, `.foo`, or something like
 * `a.b[0].c` (contains `.` or `[`, and no whitespace).
 */
export function looksLikePath(query: string): boolean {
  const q = query.trim();
  if (!q) return false;
  if (q[0] === "$" || q[0] === ".") return true;
  return /[.[]/.test(q) && !/\s/.test(q);
}

/**
 * Parse `$.data[0]["weird key"].name` (the `$` and leading dot are optional).
 * Bracketed numbers become indices; `.0` stays a string key (it still resolves on arrays).
 * Returns null when the text isn't a well-formed path.
 */
export function parsePath(query: string): JsonPath | null {
  let s = query.trim();
  if (s.startsWith("$")) s = s.slice(1);
  const path: JsonPath = [];
  let i = 0;
  let first = true;
  while (i < s.length) {
    const c = s[i];
    if (c === "[") {
      const close = findBracketEnd(s, i);
      if (close < 0) return null;
      const inner = s.slice(i + 1, close).trim();
      if (/^\d+$/.test(inner)) path.push(Number(inner));
      else if (/^"(?:\\.|[^"\\])*"$/.test(inner)) {
        try {
          path.push(JSON.parse(inner) as string);
        } catch {
          return null;
        }
      } else if (/^'(?:\\.|[^'\\])*'$/.test(inner)) path.push(inner.slice(1, -1).replace(/\\(.)/g, "$1"));
      else return null;
      i = close + 1;
    } else {
      if (c === ".") i++;
      else if (!first) return null;
      let j = i;
      while (j < s.length && s[j] !== "." && s[j] !== "[") j++;
      const name = s.slice(i, j);
      if (!name || /\s/.test(name) || name.includes("]")) return null;
      path.push(name);
      i = j;
    }
    first = false;
  }
  return path;
}

function findBracketEnd(s: string, open: number): number {
  let quote: string | null = null;
  for (let i = open + 1; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "]") return i;
  }
  return -1;
}

/**
 * Walk the path through the value. Returns the canonical path (array steps as numbers,
 * object steps as strings) or null when some step doesn't exist.
 */
export function resolvePath(root: unknown, path: readonly PathSegment[]): JsonPath | null {
  const out: JsonPath = [];
  let node: unknown = root;
  for (const seg of path) {
    if (Array.isArray(node)) {
      const idx = typeof seg === "number" ? seg : /^\d+$/.test(seg) ? Number(seg) : NaN;
      if (!(idx >= 0 && idx < node.length)) return null;
      out.push(idx);
      node = node[idx];
    } else if (node !== null && typeof node === "object") {
      const key = String(seg);
      if (!Object.prototype.hasOwnProperty.call(node, key)) return null;
      out.push(key);
      node = (node as Record<string, unknown>)[key];
    } else return null;
  }
  return out;
}

/** Value at a (canonical) path; undefined when missing. */
export function valueAt(root: unknown, path: readonly PathSegment[]): unknown {
  let node: unknown = root;
  for (const seg of path) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string | number, unknown>)[seg];
  }
  return node;
}

/** Resolve a free-form query as a path, when it looks like one. */
export function resolvePathQuery(root: unknown, query: string): JsonPath | null {
  if (!looksLikePath(query)) return null;
  const parsed = parsePath(query);
  return parsed ? resolvePath(root, parsed) : null;
}
