import { HTTP_METHODS, type HttpMethod, type KeyValue, type SatchelRequest } from "@/types";
import { normalizeRequest, paramsFromUrl } from "@/url";
import { setVariable, type VariableContext } from "@/variables";
import type { ScriptInput, ScriptLog, ScriptPhase, ScriptRequest, ScriptResponse, VariableChange } from "./types";

/**
 * Between the app's request model and what a script sees: the input for a
 * run, and how its result changes the request, the variables and the body.
 */

/** Post-response scripts get the body as text; past this they're skipped (with a note in the Console). */
export const MAX_SCRIPT_BODY = 5 * 1024 * 1024;

/** A line in the response's Console: what a script logged, or a variable it wrote. */
export interface ConsoleEntry extends ScriptLog {
  phase: ScriptPhase;
}

const values = (list: readonly KeyValue[] | undefined): Record<string, string> =>
  Object.fromEntries((list ?? []).filter((v) => v.enabled).map((v) => [v.key, v.value]));

export function scriptRequestOf(request: SatchelRequest): ScriptRequest {
  const b = request.body;
  return {
    method: request.method,
    url: request.url,
    headers: request.headers.filter((h) => h.enabled && h.key).map((h): [string, string] => [h.key, h.value]),
    body: b.mode === "raw" ? b.raw : null,
    bodyMode: b.mode === "raw" ? "raw" : b.mode === "none" ? "none" : "other",
  };
}

export function scriptInput(
  phase: ScriptPhase,
  code: string,
  request: SatchelRequest,
  ctx: VariableContext,
  response?: ScriptResponse,
): ScriptInput {
  return {
    phase,
    code,
    environment: { name: ctx.environment?.name ?? null, values: values(ctx.environment?.variables) },
    collection: values(ctx.collection?.variables),
    globals: values(ctx.globals),
    request: scriptRequestOf(request),
    ...(response ? { response } : {}),
  };
}

/**
 * The request as the pre-request script left it: method, URL (the query table
 * follows it), the enabled headers, and a raw body. Only this send uses it;
 * the saved request doesn't change.
 */
export function applyScriptRequest(request: SatchelRequest, changed: ScriptRequest): SatchelRequest {
  const method = changed.method.toUpperCase();
  if (!HTTP_METHODS.includes(method as HttpMethod)) throw new Error(`The script set an unknown method: ${changed.method}.`);
  const headers = changed.headers.map(([key, value]) => ({ key, value, enabled: true }));
  let body = request.body;
  if (changed.bodyMode === "raw" && changed.body !== null && (request.body.mode !== "raw" || changed.body !== request.body.raw)) {
    const language = changed.json ? "json" : request.body.mode === "raw" ? request.body.language : "text";
    body = { mode: "raw", language, raw: changed.body };
  }
  return normalizeRequest({ ...request, method: method as HttpMethod, url: changed.url, params: paramsFromUrl(changed.url, request.params), headers, body });
}

/** The variables a send resolves with, after a script's writes. */
export function contextWithChanges(ctx: VariableContext, changes: readonly VariableChange[]): VariableContext {
  let { environment, globals } = ctx;
  for (const c of changes) {
    if (c.scope === "globals") globals = setVariable(globals, c.key, c.value);
    else if (environment) environment = { ...environment, variables: setVariable(environment.variables, c.key, c.value) };
  }
  return { ...ctx, environment, globals };
}

export function tagged(phase: ScriptPhase, logs: readonly ScriptLog[]): ConsoleEntry[] {
  return logs.map((l) => ({ ...l, phase }));
}
