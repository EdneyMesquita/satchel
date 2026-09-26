import type { AuthConfig, Collection, KeyValue, RequestBody, SatchelRequest, TreeNode } from "./types";

export class PostmanImportError extends Error {}

interface PmKeyValue {
  key: string;
  value?: string;
  disabled?: boolean;
}

interface PmUrl {
  raw?: string;
}

interface PmAuthEntry {
  key: string;
  value?: string;
}

interface PmAuth {
  type: string;
  bearer?: PmAuthEntry[];
  basic?: PmAuthEntry[];
  apikey?: PmAuthEntry[];
}

interface PmBody {
  mode?: string;
  raw?: string;
  options?: { raw?: { language?: string } };
  urlencoded?: PmKeyValue[];
}

interface PmRequest {
  method?: string;
  header?: PmKeyValue[];
  url?: PmUrl | string;
  auth?: PmAuth;
  body?: PmBody;
}

interface PmItem {
  name?: string;
  item?: PmItem[];
  request?: PmRequest;
}

interface PmCollection {
  info?: { name?: string; schema?: string };
  item?: PmItem[];
  variable?: PmKeyValue[];
}

const newId = () => crypto.randomUUID();

function toUrlString(url: PmUrl | string | undefined): string {
  if (!url) return "";
  if (typeof url === "string") return url;
  return url.raw ?? "";
}

function toKeyValues(entries: PmKeyValue[] | undefined): KeyValue[] {
  if (!entries) return [];
  return entries.map((entry) => ({
    key: entry.key,
    value: entry.value ?? "",
    enabled: !entry.disabled,
  }));
}

function findAuthValue(entries: PmAuthEntry[] | undefined, key: string): string {
  return entries?.find((entry) => entry.key === key)?.value ?? "";
}

function toAuth(auth: PmAuth | undefined): AuthConfig {
  if (!auth || auth.type === "noauth") return { type: "none" };
  switch (auth.type) {
    case "bearer":
      return { type: "bearer", token: findAuthValue(auth.bearer, "token") };
    case "basic":
      return {
        type: "basic",
        username: findAuthValue(auth.basic, "username"),
        password: findAuthValue(auth.basic, "password"),
      };
    case "apikey":
      return {
        type: "apikey",
        key: findAuthValue(auth.apikey, "key"),
        value: findAuthValue(auth.apikey, "value"),
        in: findAuthValue(auth.apikey, "in") === "query" ? "query" : "header",
      };
    default:
      return { type: "none" };
  }
}

function toBody(body: PmBody | undefined): RequestBody {
  if (!body || !body.mode || body.mode === "none") return { mode: "none" };
  if (body.mode === "raw") {
    const language = body.options?.raw?.language;
    return {
      mode: "raw",
      raw: body.raw ?? "",
      language: language === "json" || language === "xml" || language === "html" ? language : "text",
    };
  }
  if (body.mode === "urlencoded") {
    return { mode: "urlencoded", params: toKeyValues(body.urlencoded) };
  }
  // formdata / file / graphql aren't modeled yet — surface as an empty raw body
  // rather than silently dropping the request.
  return { mode: "raw", raw: "", language: "text" };
}

function toRequest(name: string, pmRequest: PmRequest): SatchelRequest {
  const method = (pmRequest.method ?? "GET").toUpperCase() as SatchelRequest["method"];
  return {
    id: newId(),
    name,
    method,
    url: toUrlString(pmRequest.url),
    params: [],
    headers: toKeyValues(pmRequest.header),
    auth: toAuth(pmRequest.auth),
    body: toBody(pmRequest.body),
  };
}

function toTreeNode(item: PmItem): TreeNode {
  const name = item.name ?? "Untitled";
  if (item.request) {
    return { type: "request", id: newId(), request: toRequest(name, item.request) };
  }
  return {
    type: "folder",
    id: newId(),
    name,
    children: (item.item ?? []).map(toTreeNode),
  };
}

export function parsePostmanCollection(json: unknown): Collection {
  if (typeof json !== "object" || json === null) {
    throw new PostmanImportError("This file isn't a Postman collection — expected a JSON object.");
  }
  const pm = json as PmCollection;
  if (!pm.info?.name) {
    throw new PostmanImportError("Missing info.name — this doesn't look like a Postman collection export.");
  }
  if (!Array.isArray(pm.item)) {
    throw new PostmanImportError("Missing item[] — this collection has no requests to import.");
  }

  return {
    id: newId(),
    name: pm.info.name,
    variables: toKeyValues(pm.variable),
    items: pm.item.map(toTreeNode),
  };
}
