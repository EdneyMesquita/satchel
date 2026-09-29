import { describe, expect, it } from "vitest";
import type { SatchelRequest } from "@/types";
import { autoHeaders, autoQueryParams } from "./autoHeaders";

const base: SatchelRequest = {
  id: "r",
  name: "r",
  method: "POST",
  url: "",
  params: [],
  headers: [],
  auth: { type: "none" },
  body: { mode: "none" },
};

describe("autoHeaders", () => {
  it("adds bearer auth, JSON content type and length", () => {
    const rows = autoHeaders({ ...base, auth: { type: "bearer", token: "{{token}}" }, body: { mode: "raw", raw: '{"a":"{{x}}"}', language: "json" } }, [
      { key: "x", value: "é", enabled: true },
    ]);
    expect(rows).toEqual([
      { key: "Authorization", value: "Bearer {{token}}" },
      { key: "Content-Type", value: "application/json" },
      { key: "Content-Length", value: "10" },
    ]);
  });
  it("skips Content-Type when the user set one, and Content-Length on GET", () => {
    const rows = autoHeaders(
      { ...base, method: "GET", headers: [{ key: "content-type", value: "text/plain", enabled: true }], body: { mode: "raw", raw: "{}", language: "json" } },
      [],
    );
    expect(rows).toEqual([]);
  });
  it("encodes basic auth with resolved values", () => {
    const rows = autoHeaders({ ...base, auth: { type: "basic", username: "{{u}}", password: "p" } }, [{ key: "u", value: "ana", enabled: true }]);
    expect(rows).toEqual([{ key: "Authorization", value: `Basic ${btoa("ana:p")}` }]);
  });
  it("adds header API keys and form content headers", () => {
    const rows = autoHeaders({ ...base, auth: { type: "apikey", key: "X-Key", value: "{{k}}", in: "header" }, body: { mode: "formdata", fields: [] } }, []);
    expect(rows.map((r) => r.key)).toEqual(["X-Key", "Content-Type", "Content-Length"]);
  });
});

describe("autoQueryParams", () => {
  it("shows a query API key", () => {
    expect(autoQueryParams({ ...base, auth: { type: "apikey", key: "api_key", value: "{{k}}", in: "query" } })).toEqual([{ key: "api_key", value: "{{k}}" }]);
    expect(autoQueryParams({ ...base, auth: { type: "apikey", key: "api_key", value: "v", in: "header" } })).toEqual([]);
  });
});
