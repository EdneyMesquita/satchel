import { describe, expect, it } from "vitest";
import type { SatchelRequest } from "@/types";
import { applyScriptRequest, contextWithChanges, scriptInput, scriptRequestOf } from "./pipeline";

const request = (over: Partial<SatchelRequest> = {}): SatchelRequest => ({
  id: "r1",
  name: "List orders",
  method: "GET",
  url: "{{baseUrl}}/orders?limit=20",
  params: [{ key: "limit", value: "20", enabled: true }, { key: "debug", value: "1", enabled: false }],
  pathVariables: {},
  headers: [{ key: "Accept", value: "application/json", enabled: true }, { key: "X-Off", value: "x", enabled: false }],
  auth: { type: "none" },
  body: { mode: "none" },
  ...over,
});

const ctx = {
  environment: { id: "e1", name: "Staging", variables: [{ key: "token", value: "t1", enabled: true }, { key: "off", value: "x", enabled: false }] },
  collection: { id: "c1", name: "Shop", variables: [{ key: "baseUrl", value: "http://c", enabled: true }], items: [] },
  globals: [{ key: "ua", value: "satchel", enabled: true }],
};

describe("script pipeline", () => {
  it("gives the script the unresolved request and each scope's enabled variables", () => {
    const input = scriptInput("pre", "x", request(), ctx);
    expect(input.request).toEqual({ method: "GET", url: "{{baseUrl}}/orders?limit=20", headers: [["Accept", "application/json"]], body: null, bodyMode: "none" });
    expect(input.environment).toEqual({ name: "Staging", values: { token: "t1" } });
    expect(input.collection).toEqual({ baseUrl: "http://c" });
    expect(input.globals).toEqual({ ua: "satchel" });
    expect(scriptRequestOf(request({ body: { mode: "urlencoded", params: [] } })).bodyMode).toBe("other");
  });

  it("applies the script's request: method, URL (the query table follows), headers and body", () => {
    const out = applyScriptRequest(request(), {
      method: "post",
      url: "{{baseUrl}}/orders?limit=50&sort=-id",
      headers: [["Accept", "text/plain"], ["X-Trace", "1"]],
      body: '{"a":1}',
      bodyMode: "raw",
      json: true,
    });
    expect(out.method).toBe("POST");
    expect(out.params).toEqual([
      { key: "limit", value: "50", enabled: true },
      { key: "sort", value: "-id", enabled: true },
      { key: "debug", value: "1", enabled: false },
    ]);
    expect(out.headers).toEqual([{ key: "Accept", value: "text/plain", enabled: true }, { key: "X-Trace", value: "1", enabled: true }]);
    expect(out.body).toEqual({ mode: "raw", language: "json", raw: '{"a":1}' });
  });

  it("keeps a body the script didn't touch, and refuses unknown methods", () => {
    const form = request({ body: { mode: "formdata", fields: [] } });
    expect(applyScriptRequest(form, { ...scriptRequestOf(form) }).body).toBe(form.body);
    expect(() => applyScriptRequest(request(), { ...scriptRequestOf(request()), method: "FETCH" })).toThrow(/unknown method/);
  });

  it("resolves this send with the script's variable writes", () => {
    const next = contextWithChanges(ctx, [
      { scope: "environment", key: "token", value: "t2" },
      { scope: "globals", key: "ua", value: null },
      { scope: "globals", key: "sig", value: "abc" },
    ]);
    expect(next.environment?.variables.find((v) => v.key === "token")?.value).toBe("t2");
    expect(next.globals).toEqual([{ key: "sig", value: "abc", enabled: true }]);
    expect(next.collection).toBe(ctx.collection);
  });
});
