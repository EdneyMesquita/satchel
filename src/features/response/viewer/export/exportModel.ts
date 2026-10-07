import { displayPath } from "../jsonPath";
import { findRecordLists, inferColumns, toCsv, type Column, type RecordList } from "../table/tableModel";

/**
 * Response export: file names, the extension a raw body gets from its
 * content type, and the CSV of a record list (the same CSV the Table view
 * copies: inferred columns, nested values as JSON, RFC 4180 quoting).
 */

export type ExportExt = "json" | "xml" | "html" | "csv" | "txt";

const MAX_SLUG = 60;

/** "Listar usuários (v2)" → "listar-usuarios-v2"; "response" when nothing is left. */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_SLUG)
    .replace(/^-+|-+$/g, "");
  return slug || "response";
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `<request name slug>-YYYY-MM-DD.<ext>`, in local time. */
export function exportFileName(name: string | undefined, ext: ExportExt, now: Date = new Date()): string {
  return `${slugify(name ?? "")}-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.${ext}`;
}

/** The raw body's extension, from the response's content type (parameters ignored). */
export function extensionFor(contentType: string | undefined, isJson: boolean): ExportExt {
  const type = (contentType ?? "").split(";")[0].trim().toLowerCase();
  if (type === "application/json" || type.endsWith("+json") || type.endsWith("/json")) return "json";
  if (type.endsWith("/xml") || type.endsWith("+xml")) return "xml";
  if (type === "text/html" || type === "application/xhtml") return "html";
  if (type === "text/csv") return "csv";
  if (!type && isJson) return "json";
  return "txt";
}

/** The content-type header of a response, if any. */
export function contentTypeOf(headers: readonly (readonly [string, string])[]): string | undefined {
  return headers.find(([k]) => k.toLowerCase() === "content-type")?.[1];
}

/** Lists a CSV can be made from: the same ones the Table view shows, best first. */
export function exportableLists(parsed: { ok: true; value: unknown } | { ok: false }): RecordList[] {
  return parsed.ok ? findRecordLists(parsed.value) : [];
}

/** How a list is named in the export UI: `data`, `included.users`, `$` for the root. */
export function listLabel(list: RecordList): string {
  return displayPath(list.path);
}

/** "500 rows from data" / "3 rows" for the root. */
export function listSummary(list: RecordList): string {
  const n = list.rows.length;
  const rows = `${n.toLocaleString("en-US")} ${n === 1 ? "row" : "rows"}`;
  return list.path.length ? `${rows} from ${listLabel(list)}` : rows;
}

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/**
 * The CSV's columns: the Table view's (same types), but in the order the fields
 * come in the records, where the table moves nested values to the end.
 */
export function exportColumns(rows: RecordList["rows"]): Column[] {
  const columns = inferColumns(rows);
  const seen = new Map<string, number>();
  for (const row of rows) for (const key of Object.keys(row)) if (!seen.has(key)) seen.set(key, seen.size);
  return [...columns].sort((a, b) => (seen.get(a.key) ?? 0) - (seen.get(b.key) ?? 0));
}

/** The whole list as CSV, in the response's order. */
export function csvForList(list: RecordList, columns: readonly Column[] = exportColumns(list.rows)): string {
  return toCsv(list.rows, range(list.rows.length), columns);
}

/** The header and the first `rows` records, one line each, for the preview; `more` when rows were left out. */
export function csvPreview(list: RecordList, columns: readonly Column[], rows = 4): { text: string; more: boolean } {
  const shown = Math.min(rows, list.rows.length);
  return { text: toCsv(list.rows, range(shown), columns).split("\r\n").join("\n"), more: list.rows.length > shown };
}

/** Columns whose cells hold objects or arrays (written as JSON), for the dialog's note. */
export function nestedColumns(columns: readonly Column[]): string[] {
  return columns.filter((c) => c.type === "object" || c.type === "array").map((c) => c.key);
}
