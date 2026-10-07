export type JsTokenKind = "comment" | "string" | "keyword" | "number" | "global" | "text";

export interface JsRun {
  text: string;
  kind: JsTokenKind;
}

/** CSS classes for the script editor's mirror (see index.css; strings/numbers share the JSON colors). */
export const JS_TOKEN_CLASS: Record<JsTokenKind, string | undefined> = {
  comment: "js-c",
  string: "json-string",
  keyword: "js-kw",
  number: "json-number",
  global: "js-sat",
  text: undefined,
};

const KEYWORDS = new Set([
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "default",
  "delete",
  "do",
  "else",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "in",
  "instanceof",
  "let",
  "new",
  "null",
  "of",
  "return",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "undefined",
  "var",
  "void",
  "while",
]);

/** The script API's entry points, colored brass. */
const GLOBALS = new Set(["sat", "console"]);

const IDENT = /[A-Za-z_$][\w$]*/y;
const NUMBER = /0[xX][\da-fA-F_]+n?|(?:\d[\d_]*(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?n?/y;

/** Index just past the end of a quoted run starting at `start`; `multiline` lets it cross newlines. Unterminated runs end at EOL / EOF. */
function scanQuoted(text: string, start: number, quote: string, multiline: boolean): number {
  let i = start + 1;
  while (i < text.length) {
    const c = text[i];
    if (c === "\\") i += 2;
    else if (c === quote) return i + 1;
    else if (c === "\n" && !multiline) return i;
    else i++;
  }
  return text.length;
}

/**
 * Lenient JavaScript lexer for highlighting, not a parser: it scans the whole
 * script (so block comments and template literals can span lines) and
 * classifies comments, strings, keywords, numbers and the `sat`/`console`
 * globals. Property names after `.` stay plain. Template literals are colored
 * whole, `${…}` included; regex literals are read as plain text. Runs
 * concatenate back to the input.
 */
export function tokenizeJs(text: string): JsRun[] {
  const runs: JsRun[] = [];
  let plainStart = 0;
  let i = 0;
  // the last non-space character before the current token, to spot `.prop`
  let prevSignificant = "";

  const emit = (end: number, kind: JsTokenKind, start: number) => {
    if (start > plainStart) runs.push({ text: text.slice(plainStart, start), kind: "text" });
    runs.push({ text: text.slice(start, end), kind });
    plainStart = end;
  };

  while (i < text.length) {
    const c = text[i];
    const next = text[i + 1];
    let end = -1;
    let kind: JsTokenKind = "text";

    if (c === "/" && next === "/") {
      const nl = text.indexOf("\n", i);
      end = nl < 0 ? text.length : nl;
      kind = "comment";
    } else if (c === "/" && next === "*") {
      const close = text.indexOf("*/", i + 2);
      end = close < 0 ? text.length : close + 2;
      kind = "comment";
    } else if (c === '"' || c === "'") {
      end = scanQuoted(text, i, c, false);
      kind = "string";
    } else if (c === "`") {
      end = scanQuoted(text, i, c, true);
      kind = "string";
    } else if (/[A-Za-z_$]/.test(c)) {
      IDENT.lastIndex = i;
      const word = IDENT.exec(text)![0];
      end = i + word.length;
      const isProperty = prevSignificant === "." && !text.startsWith("...", i - 3); // `a.b` / `a?.b`, but not a spread `...b`
      if (!isProperty && KEYWORDS.has(word)) kind = "keyword";
      else if (!isProperty && GLOBALS.has(word)) kind = "global";
    } else if (/\d/.test(c) || (c === "." && /\d/.test(next ?? ""))) {
      NUMBER.lastIndex = i;
      end = i + NUMBER.exec(text)![0].length;
      kind = "number";
    }

    if (end < 0) {
      if (!/\s/.test(c)) prevSignificant = c;
      i++;
      continue;
    }
    if (kind === "text") {
      // a plain identifier: leave it in the pending plain run
      prevSignificant = text[end - 1];
      i = end;
      continue;
    }
    emit(end, kind, i);
    if (kind !== "comment") prevSignificant = text[end - 1];
    i = end;
  }

  if (plainStart < text.length) runs.push({ text: text.slice(plainStart), kind: "text" });
  return runs;
}
