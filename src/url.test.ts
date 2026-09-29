import { describe, expect, it } from "vitest";
import { applyPathParams, normalizeRequest, paramsFromUrl, pathParamNames, splitUrl, urlWithParams } from "./url";
import type { SatchelRequest } from "./types";

describe("url ↔ params sync", () => {
  it("splits base and query", () => {
    expect(splitUrl("{{baseUrl}}/products?limit=20&sort=-created")).toEqual({ base: "{{baseUrl}}/products", query: "limit=20&sort=-created" });
    expect(splitUrl("https://x.dev/a")).toEqual({ base: "https://x.dev/a", query: "" });
  });

  it("writes only enabled, named params into the URL and keeps {{variables}} raw", () => {
    const url = urlWithParams("{{baseUrl}}/products?old=1", [
      { key: "limit", value: "{{pageSize}}", enabled: true },
      { key: "category", value: "bags", enabled: false },
      { key: "", value: "x", enabled: true },
      { key: "flag", value: "", enabled: true },
    ]);
    expect(url).toBe("{{baseUrl}}/products?limit={{pageSize}}&flag");
  });

  it("re-derives params from the URL, keeping disabled rows", () => {
    const params = paramsFromUrl("/p?limit=20&page=2", [
      { key: "limit", value: "10", enabled: true },
      { key: "category", value: "bags", enabled: false },
    ]);
    expect(params).toEqual([
      { key: "limit", value: "20", enabled: true },
      { key: "page", value: "2", enabled: true },
      { key: "category", value: "bags", enabled: false },
    ]);
  });
});

describe("path params", () => {
  it("finds /:name segments in the path only", () => {
    expect(pathParamNames("http://localhost:8080/v2/products/:id/images/:imageId?x=:nope")).toEqual(["id", "imageId"]);
  });

  it("fills known values and leaves empty ones", () => {
    expect(applyPathParams("/orders/:orderId/items/:itemId?a=1", { orderId: "ord_19", itemId: "" })).toBe("/orders/ord_19/items/:itemId?a=1");
  });
});

describe("normalizeRequest", () => {
  const base: SatchelRequest = {
    id: "r", name: "r", method: "GET", url: "https://api.dev/items/:id", params: [{ key: "q", value: "1", enabled: true }],
    headers: [], auth: { type: "none" }, body: { mode: "none" },
  };

  it("moves legacy enabled params into the URL and seeds path variables", () => {
    const r = normalizeRequest(base);
    expect(r.url).toBe("https://api.dev/items/:id?q=1");
    expect(r.pathVariables).toEqual({ id: "" });
  });

  it("leaves a URL that already has a query alone", () => {
    expect(normalizeRequest({ ...base, url: "https://api.dev/items?z=2" }).url).toBe("https://api.dev/items?z=2");
  });
});
