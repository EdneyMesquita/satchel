import { tokenizeJsonLike, JSON_TOKEN_CLASS } from "@/jsonTokens";
import { splitVariableTokens } from "@/variableTokens";

export interface HighlightPart {
  text: string;
  /** json-* class for JSON tokens; undefined for plain text and variables */
  className?: string;
  /** set when this part is a {{variable}} */
  variable?: string;
}

const VARIABLE = /\{\{[\w.-]+\}\}/g;

/**
 * JSON syntax parts with {{variables}} split out, both inside strings and bare
 * (`"qty": {{qty}}`). Variables are masked before tokenizing so their braces
 * aren't read as JSON punctuation. Parts concatenate back to the input.
 */
export function jsonHighlightParts(text: string): HighlightPart[] {
  const masked = text.replace(VARIABLE, (m) => "\u0001".repeat(m.length));
  const parts: HighlightPart[] = [];
  let offset = 0;
  for (const run of tokenizeJsonLike(masked)) {
    const original = text.slice(offset, offset + run.text.length);
    offset += run.text.length;
    const className = JSON_TOKEN_CLASS[run.kind];
    for (const piece of splitVariableTokens(original)) {
      if (!piece.text) continue;
      parts.push(piece.isVariable ? { text: piece.text, variable: piece.key } : { text: piece.text, className });
    }
  }
  return parts;
}
