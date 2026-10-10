import type { SatchelRequest } from "@/types";

export type ScriptSide = "preRequest" | "postResponse";

/** [menu label, code] — inserted by the Scripts tab's "Snippets" menu. */
export const SCRIPT_SNIPPETS: Record<ScriptSide, [label: string, code: string][]> = {
  preRequest: [
    ["Set a header", `sat.request.headers.set("X-Trace-Id", crypto.randomUUID());`],
    ["Read an environment variable", `const baseUrl = sat.env.get("baseUrl");`],
    ["Change the JSON body", `const body = sat.request.json();\nbody.sentAt = new Date().toISOString();\nsat.request.setJson(body);`],
    ["Add a query parameter", `sat.request.query.set("debug", "1");`],
  ],
  postResponse: [
    ["Save a value to the environment", `sat.env.set("token", sat.response.json().token);`],
    ["Reshape the JSON body", `const json = sat.response.json();\nsat.response.setJson(json.data);`],
    ["Remove a field from the body", `const json = sat.response.json();\ndelete json.meta;\nsat.response.setJson(json);`],
    ["Log the status and a header", `console.log(sat.response.status, sat.response.headers.get("x-request-id"));`],
  ],
};

/** Append a snippet after a blank line, or use it as the whole script when there's none yet. */
export function appendSnippet(script: string | undefined, code: string): string {
  const current = (script ?? "").replace(/\s+$/, "");
  return current ? `${current}\n\n${code}` : code;
}

export const hasScript = (script: string | undefined) => !!script?.trim();

/** How many of the request's scripts have content (the Scripts tab's count). */
export function scriptCount(request: SatchelRequest): number {
  return Number(hasScript(request.scripts?.preRequest)) + Number(hasScript(request.scripts?.postResponse));
}
