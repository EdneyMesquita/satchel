import type { KeyValue, SatchelRequest } from "./types";
import { resolveVariables } from "./collectionTree";

// Shared by RequestEditor (single send) and RateLimitTester (repeated sends)
// so both build the exact same request off a SatchelRequest + variable set.

export function buildHeaders(request: SatchelRequest, variables: KeyValue[]): Headers {
  const headers = new Headers();
  for (const h of request.headers) {
    if (h.enabled && h.key) headers.set(h.key, resolveVariables(h.value, variables));
  }
  const auth = request.auth;
  if (auth.type === "bearer" && auth.token) headers.set("Authorization", `Bearer ${resolveVariables(auth.token, variables)}`);
  if (auth.type === "basic" && auth.username) {
    const user = resolveVariables(auth.username, variables);
    const pass = resolveVariables(auth.password, variables);
    headers.set("Authorization", `Basic ${btoa(`${user}:${pass}`)}`);
  }
  if (auth.type === "apikey" && auth.in === "header" && auth.key) headers.set(auth.key, resolveVariables(auth.value, variables));
  return headers;
}

export function buildUrl(request: SatchelRequest, variables: KeyValue[]): string {
  const resolved = resolveVariables(request.url, variables);
  const url = new URL(resolved.startsWith("http") ? resolved : `https://${resolved}`);
  for (const p of request.params) {
    if (p.enabled && p.key) url.searchParams.set(p.key, resolveVariables(p.value, variables));
  }
  if (request.auth.type === "apikey" && request.auth.in === "query" && request.auth.key) {
    url.searchParams.set(request.auth.key, resolveVariables(request.auth.value, variables));
  }
  return url.toString();
}

export function buildBody(request: SatchelRequest, variables: KeyValue[]): string | undefined {
  if (request.body.mode === "raw") return resolveVariables(request.body.raw, variables);
  if (request.body.mode === "urlencoded") {
    return new URLSearchParams(
      request.body.params.filter((p) => p.enabled).map((p) => [p.key, resolveVariables(p.value, variables)]),
    ).toString();
  }
  return undefined;
}
