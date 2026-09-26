import type { KeyValue } from "./types";

// Shared with resolveVariables (collectionTree.ts) and the highlighting
// overlay (components/VariableField.tsx) — one definition so "what counts
// as a variable" can't drift between what gets substituted and what gets
// colored (see the {{dotnetapi-local}} regression from splitting these).
export const VARIABLE_PATTERN = /\{\{([\w.-]+)\}\}/g;

export interface TextRun {
  text: string;
  isVariable: boolean;
  key?: string;
}

export function splitVariableTokens(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let lastIndex = 0;
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const index = match.index;
    if (index > lastIndex) runs.push({ text: text.slice(lastIndex, index), isVariable: false });
    runs.push({ text: match[0], isVariable: true, key: match[1] });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length || runs.length === 0) {
    runs.push({ text: text.slice(lastIndex), isVariable: false });
  }
  return runs;
}

export function findVariable(key: string, variables: KeyValue[]): KeyValue | undefined {
  return variables.find((v) => v.key === key && v.enabled);
}

export function isVariableResolved(key: string, variables: KeyValue[]): boolean {
  return findVariable(key, variables) !== undefined;
}
