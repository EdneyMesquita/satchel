import type { KeyValue, SatchelRequest } from "./types";

// Two-way sync between a request's URL and its query-param table. The URL is
// the source of truth for enabled params; disabled params only exist in the
// table. Values are kept raw (not percent-encoded) so {{variables}} survive
// round-trips; encoding happens once, at send time.

export function splitUrl(url: string): { base: string; query: string } {
  const i = url.indexOf("?");
  return i < 0 ? { base: url, query: "" } : { base: url.slice(0, i), query: url.slice(i + 1) };
}

export function parseQueryString(query: string): KeyValue[] {
  return query
    .split("&")
    .filter(Boolean)
    .map((pair) => {
      const j = pair.indexOf("=");
      return j < 0
        ? { key: pair, value: "", enabled: true }
        : { key: pair.slice(0, j), value: pair.slice(j + 1), enabled: true };
    });
}

/** Rebuild the URL's query string from the enabled params (called after editing the table). */
export function urlWithParams(url: string, params: KeyValue[]): string {
  const { base } = splitUrl(url);
  const on = params.filter((p) => p.enabled && p.key !== "");
  if (on.length === 0) return base;
  return `${base}?${on.map((p) => (p.value !== "" ? `${p.key}=${p.value}` : p.key)).join("&")}`;
}

/** Re-derive the param table from the URL (called after editing the URL), keeping disabled rows. */
export function paramsFromUrl(url: string, previous: KeyValue[]): KeyValue[] {
  return [...parseQueryString(splitUrl(url).query), ...previous.filter((p) => !p.enabled)];
}

const PATH_PARAM_PATTERN = /\/:(\w+)/g;

/** Names of `/:name` segments in the path part of the URL (never the query). */
export function pathParamNames(url: string): string[] {
  return [...new Set([...splitUrl(url).base.matchAll(PATH_PARAM_PATTERN)].map((m) => m[1]))];
}

/** Substitute `/:name` segments with their values; unknown/empty names are left as-is. */
export function applyPathParams(url: string, values: Record<string, string> | undefined): string {
  if (!values) return url;
  const { base, query } = splitUrl(url);
  const replaced = base.replace(PATH_PARAM_PATTERN, (m, name: string) => (values[name] ? `/${values[name]}` : m));
  return query ? `${replaced}?${query}` : replaced;
}

/**
 * Bring a request into the current shape: older workspaces stored enabled
 * params only in `params` (not in the URL), and had no pathVariables.
 */
export function normalizeRequest(request: SatchelRequest): SatchelRequest {
  let { url } = request;
  const params = request.params ?? [];
  if (!splitUrl(url).query && params.some((p) => p.enabled && p.key)) url = urlWithParams(url, params);
  const pathVariables = { ...(request.pathVariables ?? {}) };
  for (const name of pathParamNames(url)) if (pathVariables[name] === undefined) pathVariables[name] = "";
  return { ...request, url, params, pathVariables };
}
