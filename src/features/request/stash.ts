import type { AuthConfig, RequestBody } from "@/types";

/**
 * AuthConfig and RequestBody are unions, so switching type drops the other
 * type's fields. Keep what was there for this session, so flipping
 * None → Bearer → None → Bearer (or JSON → Form → JSON) doesn't lose work.
 */

const auths = new Map<string, Partial<Record<AuthConfig["type"], AuthConfig>>>();
const bodies = new Map<string, Partial<Record<RequestBody["mode"], RequestBody>>>();

export function switchAuth(requestId: string, current: AuthConfig, type: AuthConfig["type"]): AuthConfig {
  const saved = { ...(auths.get(requestId) ?? {}), [current.type]: current };
  auths.set(requestId, saved);
  const prev = saved[type];
  if (prev) return prev;
  switch (type) {
    case "none":
      return { type };
    case "bearer":
      return { type, token: "" };
    case "basic":
      return { type, username: "", password: "" };
    case "apikey":
      return { type, key: "X-Api-Key", value: "", in: "header" };
  }
}

export function switchBody(requestId: string, current: RequestBody, mode: RequestBody["mode"]): RequestBody {
  const saved = { ...(bodies.get(requestId) ?? {}), [current.mode]: current };
  bodies.set(requestId, saved);
  const prev = saved[mode];
  if (prev) return prev;
  switch (mode) {
    case "none":
      return { mode };
    case "raw":
      return { mode, raw: "{}", language: "json" };
    case "formdata":
      return { mode, fields: [] };
    case "urlencoded":
      return { mode, params: [] };
  }
}
