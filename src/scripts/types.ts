/** What a script sees and what it can change. Everything crosses into the sandbox as JSON. */

export type ScriptPhase = "pre" | "post";

export interface ScriptRequest {
  method: string;
  /** with {{variables}} unresolved (the pre-request script runs before resolution) */
  url: string;
  /** enabled headers, in order */
  headers: [string, string][];
  /** raw body text; null when the body isn't raw text (form data, URL-encoded) */
  body: string | null;
  /** "none" and "raw" bodies can be set by the script; the others are read-only */
  bodyMode: "none" | "raw" | "other";
  /** set when the script wrote the body with setJson() */
  json?: boolean;
}

export interface ScriptResponse {
  status: number;
  statusText: string;
  timeMs: number;
  headers: [string, string][];
  body: string;
}

export interface ScriptInput {
  phase: ScriptPhase;
  code: string;
  /** the active environment (null when none is) and its variables */
  environment: { name: string | null; values: Record<string, string> };
  collection: Record<string, string>;
  globals: Record<string, string>;
  request: ScriptRequest;
  response?: ScriptResponse;
}

export type ScriptLogLevel = "log" | "info" | "warn" | "error" | "variable";

export interface ScriptLog {
  level: ScriptLogLevel;
  message: string;
}

/** A variable written by the script; null removes it. */
export interface VariableChange {
  scope: "environment" | "globals";
  key: string;
  value: string | null;
}

export interface ScriptResult {
  /** the request as the pre-request script left it (pre only) */
  request?: ScriptRequest;
  /** set when the post-response script replaced the body */
  response?: { body: string; json: boolean };
  changes: VariableChange[];
  logs: ScriptLog[];
  error?: { message: string; line: number | null };
}
