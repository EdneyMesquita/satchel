import type { Collection, Environment, KeyValue } from "./types";
import { findVariable } from "./variableTokens";

// Where a {{variable}} gets its value, highest precedence first:
// active environment → the request's collection → globals.

export type VariableScope = "environment" | "collection" | "globals";

export interface VariableContext {
  environment?: Environment;
  collection?: Collection;
  globals: KeyValue[];
}

export interface VariableSource {
  scope: VariableScope;
  /** "Environment", "Collection", "Globals" */
  label: string;
  /** Environment or collection name; empty for globals */
  scopeName: string;
  /** undefined when this scope doesn't define the variable (or it's disabled) */
  value: string | undefined;
}

export interface VariableResolution {
  key: string;
  chain: VariableSource[];
  /** Index into chain of the scope that wins, or -1 when nothing defines it */
  winner: number;
  value: string | undefined;
}

export function resolveVariable(key: string, ctx: VariableContext): VariableResolution {
  const chain: VariableSource[] = [
    { scope: "environment", label: "Environment", scopeName: ctx.environment?.name ?? "No environment", value: valueIn(ctx.environment?.variables, key) },
    { scope: "collection", label: "Collection", scopeName: ctx.collection?.name ?? "—", value: valueIn(ctx.collection?.variables, key) },
    { scope: "globals", label: "Globals", scopeName: "", value: valueIn(ctx.globals, key) },
  ];
  const winner = chain.findIndex((c) => c.value !== undefined && c.value !== "");
  return { key, chain, winner, value: winner >= 0 ? chain[winner].value : undefined };
}

export function isResolved(key: string, ctx: VariableContext): boolean {
  return resolveVariable(key, ctx).winner >= 0;
}

/** Flattened list in precedence order — what resolveVariables()/requestBuilder consume. */
export function mergedVariables(ctx: VariableContext): KeyValue[] {
  return [...(ctx.environment?.variables ?? []), ...(ctx.collection?.variables ?? []), ...ctx.globals].filter(
    (v) => v.enabled && v.value !== "",
  );
}

function valueIn(list: KeyValue[] | undefined, key: string): string | undefined {
  return list ? findVariable(key, list)?.value : undefined;
}

/** Set (or with value === null, remove) a variable in a KeyValue list, immutably. */
export function setVariable(list: KeyValue[], key: string, value: string | null): KeyValue[] {
  const i = list.findIndex((v) => v.key === key);
  if (value === null) return i < 0 ? list : list.filter((_, j) => j !== i);
  if (i < 0) return [...list, { key, value, enabled: true }];
  return list.map((v, j) => (j === i ? { ...v, value, enabled: true } : v));
}
