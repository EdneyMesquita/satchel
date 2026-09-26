import type { AuthConfig, HttpMethod, KeyValue, RequestBody } from "./types";

export class CurlParseError extends Error {}

export interface ParsedCurl {
  method: HttpMethod;
  url: string;
  headers: KeyValue[];
  body: RequestBody;
  auth: AuthConfig;
}

const VALUE_FLAGS = new Set([
  "-X", "--request",
  "-H", "--header",
  "-d", "--data", "--data-raw", "--data-binary", "--data-ascii", "--data-urlencode",
  "-u", "--user",
  "--url",
  "-b", "--cookie",
  "-A", "--user-agent",
]);

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const n = input.length;
  while (i < n) {
    while (i < n && /\s/.test(input[i])) i++;
    if (i >= n) break;
    let token = "";
    while (i < n && !/\s/.test(input[i])) {
      const ch = input[i];
      if (ch === "'") {
        i++;
        while (i < n && input[i] !== "'") {
          token += input[i];
          i++;
        }
        i++;
      } else if (ch === '"') {
        i++;
        while (i < n && input[i] !== '"') {
          if (input[i] === "\\" && i + 1 < n) {
            token += input[i + 1];
            i += 2;
          } else {
            token += input[i];
            i++;
          }
        }
        i++;
      } else if (ch === "\\" && input[i + 1] === "\n") {
        i += 2;
        break;
      } else if (ch === "\\") {
        token += input[i + 1] ?? "";
        i += 2;
      } else {
        token += ch;
        i++;
      }
    }
    tokens.push(token);
  }
  return tokens;
}

function bodyFromRaw(raw: string, headers: KeyValue[]): RequestBody {
  const contentType = headers.find((h) => h.key.toLowerCase() === "content-type")?.value ?? "";
  if (contentType.includes("json")) return { mode: "raw", raw, language: "json" };
  if (contentType.includes("x-www-form-urlencoded")) {
    const params = raw
      .split("&")
      .filter(Boolean)
      .map((pair): KeyValue => {
        const [k, v = ""] = pair.split("=");
        return { key: decodeURIComponent(k), value: decodeURIComponent(v), enabled: true };
      });
    return { mode: "urlencoded", params };
  }
  return { mode: "raw", raw, language: /^\s*[{[]/.test(raw) ? "json" : "text" };
}

export function parseCurl(input: string): ParsedCurl {
  const trimmed = input.trim();
  if (!/^curl\b/i.test(trimmed)) {
    throw new CurlParseError("That doesn't look like a curl command — it should start with \"curl\".");
  }

  const tokens = tokenize(trimmed).slice(1);
  let url = "";
  let method: HttpMethod | null = null;
  const headers: KeyValue[] = [];
  let bodyRaw: string | null = null;
  let auth: AuthConfig = { type: "none" };

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const takesValue = VALUE_FLAGS.has(t);
    const value = takesValue ? (tokens[++i] ?? "") : "";

    switch (t) {
      case "-X":
      case "--request":
        method = value.toUpperCase() as HttpMethod;
        break;
      case "-H":
      case "--header": {
        const idx = value.indexOf(":");
        if (idx > -1) headers.push({ key: value.slice(0, idx).trim(), value: value.slice(idx + 1).trim(), enabled: true });
        break;
      }
      case "-d":
      case "--data":
      case "--data-raw":
      case "--data-binary":
      case "--data-ascii":
      case "--data-urlencode":
        bodyRaw = bodyRaw === null ? value : `${bodyRaw}&${value}`;
        break;
      case "-u":
      case "--user": {
        const [username, password = ""] = value.split(":");
        auth = { type: "basic", username, password };
        break;
      }
      case "--url":
        url = value || url;
        break;
      case "-b":
      case "--cookie":
        headers.push({ key: "Cookie", value, enabled: true });
        break;
      case "-A":
      case "--user-agent":
        headers.push({ key: "User-Agent", value, enabled: true });
        break;
      case "-I":
      case "--head":
        method = method ?? "HEAD";
        break;
      case "-G":
      case "--get":
        method = "GET";
        break;
      default:
        if (!t.startsWith("-") && !url) url = t;
    }
  }

  if (!url) throw new CurlParseError("Couldn't find a URL in that curl command.");
  if (!method) method = bodyRaw !== null ? "POST" : "GET";

  const body: RequestBody = bodyRaw !== null ? bodyFromRaw(bodyRaw, headers) : { mode: "none" };

  return { method, url, headers, body, auth };
}
