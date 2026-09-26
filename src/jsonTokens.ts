export type JsonTokenKind = "key" | "string" | "number" | "literal" | "punct" | "text";

export interface JsonRun {
  text: string;
  kind: JsonTokenKind;
}

// Lenient lexer, not a parser: the body is often invalid/incomplete JSON
// while someone is mid-edit, so this just classifies tokens by shape
// (VSCode-style: a string immediately followed by `:` reads as a key)
// rather than requiring the whole document to parse.
const TOKEN_PATTERN = /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\btrue\b|\bfalse\b|\bnull\b|[{}[\]:,]/g;

export function tokenizeJsonLike(text: string): JsonRun[] {
  const runs: JsonRun[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const index = match.index;
    if (index > lastIndex) runs.push({ text: text.slice(lastIndex, index), kind: "text" });

    const token = match[0];
    let kind: JsonTokenKind;
    if (token[0] === '"') {
      const rest = text.slice(index + token.length);
      kind = /^\s*:/.test(rest) ? "key" : "string";
    } else if (token === "true" || token === "false" || token === "null") {
      kind = "literal";
    } else if (/^[{}[\]:,]$/.test(token)) {
      kind = "punct";
    } else {
      kind = "number";
    }
    runs.push({ text: token, kind });
    lastIndex = index + token.length;
  }

  if (lastIndex < text.length) runs.push({ text: text.slice(lastIndex), kind: "text" });
  return runs;
}
