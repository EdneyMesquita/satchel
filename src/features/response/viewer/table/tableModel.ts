import type { JsonPath } from "../jsonPath";
import { primitiveText, type SearchScope } from "../jsonSearch";

/**
 * Table view: a list of records inside a response (the root array, or an
 * envelope such as `{ "data": [...] }`) as rows, with columns inferred from
 * the records' fields — the Mongo Studio document grid, for API responses.
 */

export type Row = Record<string, unknown>;

export interface RecordList {
  /** where the array lives; [] for the root */
  path: JsonPath;
  rows: Row[];
  /** true when the items are primitives, shown in a single "value" column */
  primitive: boolean;
}

export type ColumnType = "string" | "number" | "boolean" | "null" | "object" | "array" | "date" | "mixed";

export interface Column {
  key: string;
  type: ColumnType;
}

/** The single column of a list of primitives. */
export const VALUE_COLUMN = "value";

const isPlainObject = (v: unknown): v is Row => typeof v === "object" && v !== null && !Array.isArray(v);

/** How deep into envelopes to look for record lists (`{ data: { items: [...] } }` is depth 2). */
const MAX_DEPTH = 3;
/** Share of items that must be objects for an array to count as a record list. */
const OBJECT_SHARE = 0.6;

/**
 * Arrays in the document that read well as a table, best first: arrays of
 * objects before arrays of primitives, shallower before deeper, longer
 * before shorter. Empty when nothing fits.
 */
export function findRecordLists(root: unknown): RecordList[] {
  const found: (RecordList & { depth: number })[] = [];
  const visit = (value: unknown, path: JsonPath, depth: number) => {
    if (Array.isArray(value)) {
      if (value.length > 0) {
        const objects = value.filter(isPlainObject).length;
        if (objects / value.length >= OBJECT_SHARE) {
          found.push({ path, rows: value.filter(isPlainObject), primitive: false, depth });
        } else if (objects === 0 && value.every((v) => !Array.isArray(v))) {
          found.push({ path, rows: value.map((v) => ({ [VALUE_COLUMN]: v })), primitive: true, depth });
        }
      }
      return; // records inside records are for the inspector, not more tables
    }
    if (!isPlainObject(value) || depth >= MAX_DEPTH) return;
    for (const [key, child] of Object.entries(value)) visit(child, [...path, key], depth + 1);
  };
  visit(root, [], 0);
  return found
    .sort((a, b) => Number(a.primitive) - Number(b.primitive) || a.depth - b.depth || b.rows.length - a.rows.length)
    .map(({ path, rows, primitive }) => ({ path, rows, primitive }));
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

function typeOf(value: unknown): ColumnType {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "object") return "object";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string" && ISO_DATE.test(value)) return "date";
  return "string";
}

// Identity first, then human labels, then the rest in first-seen order, nested values last.
const ID_KEYS = ["id", "_id", "uuid", "key", "slug"];
const LABEL_KEYS = ["name", "title", "login", "username", "email", "label"];

function rank(key: string, type: ColumnType): number {
  const k = key.toLowerCase();
  if (ID_KEYS.includes(k)) return 0;
  if (LABEL_KEYS.includes(k)) return 1;
  if (type === "object" || type === "array") return 3;
  return 2;
}

/** Records sampled for column inference: enough for real APIs, bounded for 100k-row responses. */
const SAMPLE = 2000;

/** Columns: the union of the records' fields, typed from their non-null values. */
export function inferColumns(rows: readonly Row[]): Column[] {
  const order: string[] = [];
  const types = new Map<string, ColumnType>();
  for (const row of rows.slice(0, SAMPLE)) {
    for (const [key, value] of Object.entries(row)) {
      if (!types.has(key)) {
        order.push(key);
        types.set(key, typeOf(value));
        continue;
      }
      const seen = types.get(key)!;
      const t = typeOf(value);
      if (seen === t || t === "null" || seen === "mixed") continue;
      if (seen === "null") types.set(key, t);
      else if ((seen === "date" && t === "string") || (seen === "string" && t === "date")) types.set(key, "string");
      else types.set(key, "mixed");
    }
  }
  return order
    .map((key, i) => ({ key, i, type: types.get(key)!, rank: rank(key, types.get(key)!) }))
    .sort((a, b) => a.rank - b.rank || a.i - b.i)
    .map(({ key, type }) => ({ key, type }));
}

/** What a cell shows: primitives as text (strings unquoted), containers summarized. */
export function cellText(value: unknown): string {
  if (value === undefined) return "";
  if (Array.isArray(value)) return `[ ${value.length} ${value.length === 1 ? "item" : "items"} ]`;
  if (isPlainObject(value)) {
    const n = Object.keys(value).length;
    return `{ ${n} ${n === 1 ? "field" : "fields"} }`;
  }
  return primitiveText(value);
}

export type CellTone = "string" | "number" | "boolean" | "null" | "nested" | "missing";

export function cellTone(value: unknown): CellTone {
  if (value === undefined) return "missing";
  if (value === null) return "null";
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "object") return "nested";
  return "string";
}

export type SortDir = "asc" | "desc";
export interface Sort {
  key: string;
  dir: SortDir;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function compareValues(a: unknown, b: unknown): number {
  // missing and null sort last whatever the direction is (handled by the caller)
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") return Number(a) - Number(b);
  return collator.compare(cellText(a), cellText(b));
}

/** Row order for a sort (indices into rows); stable, blanks last in both directions. */
export function sortedOrder(rows: readonly Row[], sort: Sort | null): number[] {
  const order = rows.map((_, i) => i);
  if (!sort) return order;
  const sign = sort.dir === "asc" ? 1 : -1;
  const blank = (v: unknown) => v === undefined || v === null;
  return order.sort((i, j) => {
    const a = rows[i][sort.key];
    const b = rows[j][sort.key];
    if (blank(a) || blank(b)) return blank(a) === blank(b) ? i - j : blank(a) ? 1 : -1;
    return sign * compareValues(a, b) || i - j;
  });
}

/** The next state of a header click: ascending → descending → unsorted. */
export function nextSort(current: Sort | null, key: string): Sort | null {
  if (!current || current.key !== key) return { key, dir: "asc" };
  if (current.dir === "asc") return { key, dir: "desc" };
  return null;
}

function containsDeep(value: unknown, q: string, scope: SearchScope, depth = 0): boolean {
  if (depth > 8) return false;
  if (Array.isArray(value)) return value.some((v) => containsDeep(v, q, scope, depth + 1));
  if (isPlainObject(value)) {
    return Object.entries(value).some(
      ([k, v]) => (scope !== "values" && k.toLowerCase().includes(q)) || containsDeep(v, q, scope, depth + 1),
    );
  }
  return scope !== "keys" && primitiveText(value).toLowerCase().includes(q);
}

/**
 * Rows (as positions in `order`) that match the query: a column name (Keys),
 * any value including nested ones (Values), or either (All).
 */
export function matchingRows(rows: readonly Row[], order: readonly number[], columns: readonly Column[], query: string, scope: SearchScope): number[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const keyHits = scope === "values" ? [] : columns.filter((c) => c.key.toLowerCase().includes(q)).map((c) => c.key);
  const out: number[] = [];
  order.forEach((rowIndex, position) => {
    const row = rows[rowIndex];
    const hit = keyHits.some((k) => row[k] !== undefined) || Object.values(row).some((v) => containsDeep(v, q, scope));
    if (hit) out.push(position);
  });
  return out;
}

function csvField(value: unknown): string {
  const text = value === undefined ? "" : typeof value === "object" && value !== null ? JSON.stringify(value) : primitiveText(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** RFC 4180 CSV of the rows in the given order; nested values as JSON. */
export function toCsv(rows: readonly Row[], order: readonly number[], columns: readonly Column[]): string {
  const lines = [columns.map((c) => csvField(c.key)).join(",")];
  for (const i of order) lines.push(columns.map((c) => csvField(rows[i][c.key])).join(","));
  return lines.join("\r\n");
}
