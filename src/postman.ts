import type {
  AuthConfig,
  Collection,
  Environment,
  FormField,
  HttpMethod,
  KeyValue,
  RequestBody,
  SatchelRequest,
  TreeNode,
} from "./types";
import { HTTP_METHODS } from "./types";
import { normalizeRequest, paramsFromUrl, splitUrl, urlWithParams } from "./url";
import { VARIABLE_PATTERN } from "./variableTokens";

export class PostmanImportError extends Error {}

// ---------------------------------------------------------------------------
// Postman collection v2.0 / v2.1 shapes (only the parts Satchel reads)
// ---------------------------------------------------------------------------

interface PmKeyValue {
  key?: string | null;
  value?: unknown;
  disabled?: boolean;
}

interface PmUrl {
  raw?: string;
  protocol?: string;
  host?: string | string[];
  port?: string;
  path?: string | (string | { value?: string })[];
  query?: PmKeyValue[] | null;
  variable?: PmKeyValue[] | null;
}

interface PmAuthEntry {
  key: string;
  value?: unknown;
}

/** v2.1 stores auth params as [{key, value}], v2.0 as a plain object. */
type PmAuthParams = PmAuthEntry[] | Record<string, unknown>;

interface PmAuth {
  type?: string;
  [param: string]: PmAuthParams | string | undefined;
}

interface PmFormField extends PmKeyValue {
  type?: string;
  src?: string | string[] | null;
}

interface PmBody {
  mode?: string;
  raw?: string;
  options?: { raw?: { language?: string } };
  urlencoded?: PmKeyValue[];
  formdata?: PmFormField[];
  graphql?: { query?: string; variables?: string | Record<string, unknown> | null };
}

interface PmRequest {
  method?: string;
  header?: PmKeyValue[] | string;
  url?: PmUrl | string;
  auth?: PmAuth | null;
  body?: PmBody | null;
}

interface PmEvent {
  listen?: string;
  script?: { exec?: string | string[] };
}

interface PmItem {
  name?: string;
  item?: PmItem[];
  request?: PmRequest | string;
  auth?: PmAuth | null;
  event?: PmEvent[];
}

interface PmCollection {
  info?: { name?: string; schema?: string };
  item?: PmItem[];
  variable?: PmKeyValue[];
  auth?: PmAuth | null;
  event?: PmEvent[];
}

interface PmEnvironment {
  name?: string;
  values?: { key?: string; value?: unknown; enabled?: boolean }[];
}

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type PostmanFileKind = "collection" | "environment" | "v1" | "unknown";

export interface PostmanStats {
  requests: number;
  folders: number;
  /** collection-level variables */
  variables: number;
  methods: Partial<Record<HttpMethod, number>>;
}

export interface PostmanAnalysis {
  collection: Collection;
  stats: PostmanStats;
  /** pre-request / test scripts that won't run */
  scripts: number;
  /** GraphQL bodies converted to a JSON { query, variables } body */
  graphqlBodies: number;
  /** form-data file fields whose file has to be picked again */
  fileFields: number;
  /** Auth copied from the collection (or a folder) onto requests that inherited it */
  inheritedAuth: { type: AuthConfig["type"]; count: number } | null;
  /** Postman auth types Satchel can't represent (set to None) */
  unsupportedAuth: string[];
  /** Every {{variable}} referenced by the imported requests, sorted */
  usedVariables: string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const newId = () => crypto.randomUUID();

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown): string {
  if (v === undefined || v === null) return "";
  return typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
}

function toKeyValues(entries: PmKeyValue[] | null | undefined): KeyValue[] {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((entry) => isObject(entry) && (entry.key ?? "") !== "")
    .map((entry) => ({ key: str(entry.key), value: str(entry.value), enabled: !entry.disabled }));
}

/** v2.0 allowed headers as a single "Key: value\n…" string. */
function toHeaders(header: PmRequest["header"]): KeyValue[] {
  if (typeof header === "string") {
    return header
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const i = line.indexOf(":");
        return i < 0
          ? { key: line, value: "", enabled: true }
          : { key: line.slice(0, i).trim(), value: line.slice(i + 1).trim(), enabled: true };
      });
  }
  return toKeyValues(header);
}

function rawUrl(url: PmUrl | string | undefined): string {
  if (!url) return "";
  if (typeof url === "string") return url;
  if (url.raw) return url.raw;
  // Rebuild from parts when raw is missing.
  const host = Array.isArray(url.host) ? url.host.join(".") : (url.host ?? "");
  const path = Array.isArray(url.path)
    ? url.path.map((p) => (typeof p === "string" ? p : (p.value ?? ""))).join("/")
    : (url.path ?? "");
  const origin = `${url.protocol ? `${url.protocol}://` : ""}${host}${url.port ? `:${url.port}` : ""}`;
  return path ? `${origin}/${path.replace(/^\//, "")}` : origin;
}

function toMethod(method: string | undefined): HttpMethod {
  const m = (method ?? "GET").toUpperCase();
  return (HTTP_METHODS as string[]).includes(m) ? (m as HttpMethod) : "GET";
}

function authParam(auth: PmAuth, type: string, key: string): string {
  const params = auth[type];
  if (Array.isArray(params)) return str(params.find((entry) => entry?.key === key)?.value);
  if (isObject(params)) return str(params[key]);
  return "";
}

/** A request/folder with no auth (or type "inherit") inherits from its parent. */
function inherits(auth: PmAuth | null | undefined): boolean {
  return !auth || !auth.type || auth.type === "inherit";
}

function hasScript(events: PmEvent[] | undefined): number {
  if (!Array.isArray(events)) return 0;
  return events.filter((ev) => {
    const exec = ev?.script?.exec;
    return (Array.isArray(exec) ? exec.join("") : (exec ?? "")).trim() !== "";
  }).length;
}

function basenameOf(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

class Analyzer {
  scripts = 0;
  graphqlBodies = 0;
  fileFields = 0;
  folders = 0;
  requests = 0;
  inheritedCount = 0;
  inheritedType: AuthConfig["type"] | null = null;
  unsupportedAuth = new Set<string>();
  methods: Partial<Record<HttpMethod, number>> = {};
  used = new Set<string>();

  toAuth(auth: PmAuth): AuthConfig {
    switch (auth.type) {
      case "noauth":
        return { type: "none" };
      case "bearer":
        return { type: "bearer", token: authParam(auth, "bearer", "token") };
      case "basic":
        return {
          type: "basic",
          username: authParam(auth, "basic", "username"),
          password: authParam(auth, "basic", "password"),
        };
      case "apikey":
        return {
          type: "apikey",
          key: authParam(auth, "apikey", "key"),
          value: authParam(auth, "apikey", "value"),
          in: authParam(auth, "apikey", "in") === "query" ? "query" : "header",
        };
      default:
        if (auth.type) this.unsupportedAuth.add(auth.type);
        return { type: "none" };
    }
  }

  toBody(body: PmBody | null | undefined): RequestBody {
    if (!body || !body.mode || body.mode === "none") return { mode: "none" };
    switch (body.mode) {
      case "raw": {
        const language = body.options?.raw?.language;
        return {
          mode: "raw",
          raw: body.raw ?? "",
          language: language === "json" || language === "xml" || language === "html" ? language : "text",
        };
      }
      case "urlencoded":
        return { mode: "urlencoded", params: toKeyValues(body.urlencoded) };
      case "formdata": {
        const fields: FormField[] = (Array.isArray(body.formdata) ? body.formdata : [])
          .filter((f) => isObject(f) && (f.key ?? "") !== "")
          .map((f): FormField => {
            if (f.type === "file") {
              this.fileFields++;
              const src = Array.isArray(f.src) ? f.src[0] : f.src;
              return {
                key: str(f.key),
                value: "",
                enabled: !f.disabled,
                type: "file",
                ...(src ? { fileName: basenameOf(src) } : {}),
              };
            }
            return { key: str(f.key), value: str(f.value), enabled: !f.disabled, type: "text" };
          });
        return { mode: "formdata", fields };
      }
      case "graphql": {
        this.graphqlBodies++;
        const g = body.graphql ?? {};
        let variables: unknown = {};
        if (isObject(g.variables)) variables = g.variables;
        else if (typeof g.variables === "string" && g.variables.trim()) {
          try {
            variables = JSON.parse(g.variables);
          } catch {
            variables = g.variables;
          }
        }
        return { mode: "raw", raw: JSON.stringify({ query: g.query ?? "", variables }, null, 2), language: "json" };
      }
      default:
        // "file" (binary) bodies aren't modeled.
        return { mode: "none" };
    }
  }

  toRequest(id: string, name: string, pm: PmRequest, inherited: AuthConfig | null): SatchelRequest {
    const url = typeof pm.url === "object" && pm.url ? pm.url : undefined;
    let fullUrl = rawUrl(pm.url);

    // Enabled query entries live in the URL; disabled ones only in the table.
    const query = toKeyValues(url?.query);
    const enabledQuery = query.filter((q) => q.enabled);
    if (!splitUrl(fullUrl).query && enabledQuery.length) fullUrl = urlWithParams(fullUrl, enabledQuery);
    const params = paramsFromUrl(fullUrl, query.filter((q) => !q.enabled));

    const pathVariables: Record<string, string> = {};
    for (const v of Array.isArray(url?.variable) ? url.variable : []) {
      if (v?.key) pathVariables[str(v.key)] = str(v.value);
    }

    let auth: AuthConfig;
    if (inherits(pm.auth)) {
      auth = inherited ?? { type: "none" };
      if (inherited && inherited.type !== "none") {
        this.inheritedCount++;
        this.inheritedType ??= inherited.type;
      }
    } else {
      auth = this.toAuth(pm.auth as PmAuth);
    }

    const request = normalizeRequest({
      id,
      name,
      method: toMethod(pm.method),
      url: fullUrl,
      params,
      pathVariables,
      headers: toHeaders(pm.header),
      auth,
      body: this.toBody(pm.body),
    });

    this.requests++;
    this.methods[request.method] = (this.methods[request.method] ?? 0) + 1;
    const text = JSON.stringify([request.url, request.params, request.pathVariables, request.headers, request.auth, request.body]);
    for (const m of text.matchAll(VARIABLE_PATTERN)) this.used.add(m[1]);
    return request;
  }

  toTreeNode(item: PmItem, inherited: AuthConfig | null): TreeNode {
    this.scripts += hasScript(item.event);
    const name = item.name || "Untitled";
    if (item.request && !Array.isArray(item.item)) {
      const id = newId();
      const pm: PmRequest = typeof item.request === "string" ? { url: item.request } : item.request;
      return { type: "request", id, request: this.toRequest(id, name, pm, inherited) };
    }
    this.folders++;
    const folderAuth = inherits(item.auth) ? inherited : this.toAuth(item.auth as PmAuth);
    return {
      type: "folder",
      id: newId(),
      name,
      children: (item.item ?? []).map((child) => this.toTreeNode(child, folderAuth)),
    };
  }
}

/** What kind of Postman export this parsed JSON is. */
export function detectPostmanFile(json: unknown): PostmanFileKind {
  if (!isObject(json)) return "unknown";
  if (isObject(json.info) && Array.isArray(json.item)) return "collection";
  if (Array.isArray(json.values) && !("item" in json)) return "environment";
  if (Array.isArray(json.requests)) return "v1";
  return "unknown";
}

/** Convert a v2.0/v2.1 collection and collect everything the import review needs to warn about. */
export function analyzePostmanCollection(json: unknown): PostmanAnalysis {
  if (!isObject(json)) {
    throw new PostmanImportError("This file isn't a Postman collection — expected a JSON object.");
  }
  const pm = json as PmCollection;
  if (!pm.info?.name) {
    throw new PostmanImportError("Missing info.name — this doesn't look like a Postman collection export.");
  }
  if (!Array.isArray(pm.item)) {
    throw new PostmanImportError("Missing item[] — this collection has no requests to import.");
  }

  const a = new Analyzer();
  a.scripts += hasScript(pm.event);
  const collectionAuth = inherits(pm.auth) ? null : a.toAuth(pm.auth as PmAuth);
  const variables = toKeyValues(pm.variable);
  const collection: Collection = {
    id: newId(),
    name: pm.info.name,
    variables,
    items: pm.item.map((item) => a.toTreeNode(item, collectionAuth)),
  };

  return {
    collection,
    stats: { requests: a.requests, folders: a.folders, variables: variables.length, methods: a.methods },
    scripts: a.scripts,
    graphqlBodies: a.graphqlBodies,
    fileFields: a.fileFields,
    inheritedAuth: a.inheritedCount && a.inheritedType ? { type: a.inheritedType, count: a.inheritedCount } : null,
    unsupportedAuth: [...a.unsupportedAuth],
    usedVariables: [...a.used].sort((x, y) => x.localeCompare(y)),
  };
}

export function parsePostmanCollection(json: unknown): Collection {
  return analyzePostmanCollection(json).collection;
}

/** A Postman environment export → a Satchel environment (enabled values only, no color yet). */
export function parsePostmanEnvironment(json: unknown, fileName?: string): Environment {
  if (!isObject(json) || !Array.isArray(json.values)) {
    throw new PostmanImportError("This doesn't look like a Postman environment export.");
  }
  const pm = json as PmEnvironment;
  const fallback = fileName ? fileName.replace(/\.postman_environment\.json$|\.json$/i, "") : "";
  return {
    id: newId(),
    name: pm.name || fallback || "Imported environment",
    variables: (pm.values ?? [])
      .filter((v) => isObject(v) && v.key && v.enabled !== false)
      .map((v) => ({ key: str(v.key), value: str(v.value), enabled: true })),
  };
}
