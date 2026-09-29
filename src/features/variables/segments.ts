import type { KeyValue } from "@/types";
import { splitVariableTokens } from "@/variableTokens";
import { splitUrl } from "@/url";

/**
 * Pure markup for variable-aware text. The same segments drive the
 * VariableInput mirror, read-only VariableText and the resolved-URL line,
 * so what gets colored can't drift from what gets substituted.
 */

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "var"; text: string; key: string }
  /** `:name` in the URL path (the leading "/" is emitted as its own text segment) */
  | { kind: "path"; text: string; name: string }
  /** `?` `&` `=` in the query string */
  | { kind: "qs"; text: string };

function pushText(out: Segment[], text: string) {
  if (!text) return;
  const last = out[out.length - 1];
  if (last?.kind === "text") last.text += text;
  else out.push({ kind: "text", text });
}

/** Plain text: `{{variables}}` only. */
export function textSegments(text: string): Segment[] {
  const out: Segment[] = [];
  for (const run of splitVariableTokens(text)) {
    if (run.isVariable) out.push({ kind: "var", text: run.text, key: run.key! });
    else pushText(out, run.text);
  }
  return out;
}

const URL_PATTERN = /\{\{([\w.-]+)\}\}|\/:(\w+)|([?&=])/g;

/** A URL: `{{variables}}`, `/:path` params before the `?`, and `? & =` separators in the query. */
export function urlSegments(url: string): Segment[] {
  const out: Segment[] = [];
  const q = url.indexOf("?");
  const qi = q < 0 ? Infinity : q;
  let last = 0;
  for (const m of url.matchAll(URL_PATTERN)) {
    const index = m.index;
    pushText(out, url.slice(last, index));
    if (m[1]) out.push({ kind: "var", text: m[0], key: m[1] });
    else if (m[2]) {
      if (index < qi) {
        pushText(out, "/");
        out.push({ kind: "path", text: `:${m[2]}`, name: m[2] });
      } else pushText(out, m[0]);
    } else {
      const sep = m[3];
      const isQs = sep === "?" ? index === qi : index > qi;
      if (isQs) out.push({ kind: "qs", text: sep });
      else pushText(out, sep);
    }
    last = index + m[0].length;
  }
  pushText(out, url.slice(last));
  return out;
}

export type ResolvedSegment =
  | { kind: "text"; text: string }
  /** value undefined → not defined anywhere (rendered as the literal `{{key}}`) */
  | { kind: "var"; key: string; value: string | undefined }
  /** value undefined → the path param has no value yet */
  | { kind: "path"; name: string; value: string | undefined };

/** Substitute `{{variables}}` in plain text; unknown ones are left literal. */
export function resolvePlain(text: string, resolve: (key: string) => string | undefined): string {
  return text.replace(/\{\{([\w.-]+)\}\}/g, (m, key: string) => resolve(key) ?? m);
}

/** The "→ resolved URL" line: each substituted value becomes its own segment. */
export function resolvedUrlSegments(
  url: string,
  pathVariables: Record<string, string> | undefined,
  resolve: (key: string) => string | undefined,
): ResolvedSegment[] {
  const out: ResolvedSegment[] = [];
  const text = (t: string) => {
    if (!t) return;
    const last = out[out.length - 1];
    if (last?.kind === "text") last.text += t;
    else out.push({ kind: "text", text: t });
  };
  const { base } = splitUrl(url);
  const qi = url.includes("?") ? base.length : Infinity;
  let last = 0;
  for (const m of url.matchAll(/\{\{([\w.-]+)\}\}|\/:(\w+)/g)) {
    text(url.slice(last, m.index));
    if (m[1]) out.push({ kind: "var", key: m[1], value: resolve(m[1]) });
    else if (m.index < qi) {
      const raw = pathVariables?.[m[2]];
      text("/");
      out.push({ kind: "path", name: m[2], value: raw ? resolvePlain(raw, resolve) : undefined });
    } else text(m[0]);
    last = m.index + m[0].length;
  }
  text(url.slice(last));
  return out;
}

/** Resolver over a flattened, precedence-ordered variable list (see mergedVariables). */
export function resolverFor(variables: KeyValue[]): (key: string) => string | undefined {
  return (key) => variables.find((v) => v.key === key && v.enabled && v.value !== "")?.value;
}
