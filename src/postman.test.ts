import { describe, expect, it } from "vitest";
import type { SatchelRequest } from "./types";
import {
  analyzePostmanCollection,
  detectPostmanFile,
  parsePostmanCollection,
  parsePostmanEnvironment,
  PostmanImportError,
} from "./postman";

describe("parsePostmanCollection", () => {
  it("parses a real-world flat collection (no folders, no collection variables)", () => {
    const collection = parsePostmanCollection({
      info: { name: "DOTNETAPI", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
      item: [
        {
          name: "Get Items",
          request: {
            method: "GET",
            header: [],
            url: { raw: "{{dotnetapi-local}}/items" },
            body: null,
          },
        },
        {
          name: "Create Items",
          request: {
            method: "POST",
            header: [],
            url: { raw: "{{dotnetapi-local}}/items" },
            body: { mode: "raw", raw: '{"title":"x"}', options: { raw: { language: "json" } } },
          },
        },
      ],
    });

    expect(collection.name).toBe("DOTNETAPI");
    expect(collection.variables).toEqual([]);
    expect(collection.items).toHaveLength(2);
    const [get, post] = collection.items;
    if (get.type !== "request" || post.type !== "request") throw new Error("expected requests");
    expect(get.request.method).toBe("GET");
    expect(get.request.url).toBe("{{dotnetapi-local}}/items");
    expect(get.request.body).toEqual({ mode: "none" });
    expect(post.request.body).toEqual({ mode: "raw", raw: '{"title":"x"}', language: "json" });
    // The tree node id and the request's own id must be the same value -
    // App.tsx's edit path looks up nodes by request.id, so a mismatch here
    // silently breaks editing (see the App.tsx history for that bug).
    expect(get.id).toBe(get.request.id);
  });

  it("nests folders and preserves headers, auth, and disabled flags", () => {
    const collection = parsePostmanCollection({
      info: { name: "Nested" },
      item: [
        {
          name: "Repositories",
          item: [
            {
              name: "Get repo",
              request: {
                method: "get",
                header: [
                  { key: "Accept", value: "application/json" },
                  { key: "X-Debug", value: "1", disabled: true },
                ],
                url: { raw: "https://api.github.com/repos/{{owner}}/{{repo}}" },
                auth: { type: "bearer", bearer: [{ key: "token", value: "{{token}}" }] },
              },
            },
          ],
        },
      ],
    });

    const folder = collection.items[0];
    if (folder.type !== "folder") throw new Error("expected a folder");
    expect(folder.name).toBe("Repositories");
    const request = folder.children[0];
    if (request.type !== "request") throw new Error("expected a request");
    expect(request.request.method).toBe("GET");
    expect(request.request.headers).toEqual([
      { key: "Accept", value: "application/json", enabled: true },
      { key: "X-Debug", value: "1", enabled: false },
    ]);
    expect(request.request.auth).toEqual({ type: "bearer", token: "{{token}}" });
  });

  it("rejects a file with no info.name", () => {
    expect(() => parsePostmanCollection({ item: [] })).toThrow(PostmanImportError);
  });

  it("rejects a file with no item array", () => {
    expect(() => parsePostmanCollection({ info: { name: "x" } })).toThrow(PostmanImportError);
  });

  it("rejects non-object input", () => {
    expect(() => parsePostmanCollection("not json")).toThrow(PostmanImportError);
    expect(() => parsePostmanCollection(null)).toThrow(PostmanImportError);
  });
});

const FULL = {
  info: { name: "Acme Billing", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
  auth: { type: "bearer", bearer: [{ key: "token", value: "{{billingToken}}", type: "string" }] },
  variable: [
    { key: "billingUrl", value: "https://billing.acme.test/api" },
    { key: "apiVersion", value: "2024-10" },
  ],
  event: [{ listen: "prerequest", script: { exec: ["pm.environment.set('ts', Date.now());"] } }],
  item: [
    {
      name: "Customers",
      item: [
        {
          name: "List customers",
          request: {
            method: "GET",
            url: {
              raw: "{{billingUrl}}/customers?limit=50",
              query: [
                { key: "limit", value: "50" },
                { key: "email", value: "ana@acme.test", disabled: true },
              ],
            },
          },
        },
        {
          name: "Get customer",
          request: { method: "GET", url: { raw: "{{billingUrl}}/customers/:customerId", variable: [{ key: "customerId", value: "cus_19" }] } },
        },
      ],
    },
    {
      name: "Attach PDF",
      event: [{ listen: "test", script: { exec: ["pm.test('ok', () => {});"] } }, { listen: "prerequest", script: { exec: [""] } }],
      request: {
        method: "POST",
        body: {
          mode: "formdata",
          formdata: [
            { key: "file", type: "file", src: "/Users/rafa/Downloads/invoice-0042.pdf" },
            { key: "note", type: "text", value: "Signed copy", disabled: true },
          ],
        },
        url: "{{billingUrl}}/attachments",
      },
    },
    {
      name: "OAuth token",
      request: { method: "POST", auth: { type: "noauth" }, url: "{{billingUrl}}/oauth/token" },
    },
    {
      name: "Signed",
      request: { method: "PUT", auth: { type: "awsv4", awsv4: [] }, url: "{{billingUrl}}/signed" },
    },
    {
      name: "Usage (GraphQL)",
      request: {
        method: "POST",
        body: { mode: "graphql", graphql: { query: "{ usage { total } }", variables: '{"month":"2026-09"}' } },
        url: "{{billingUrl}}/graphql",
      },
    },
  ],
};

describe("analyzePostmanCollection", () => {
  const a = analyzePostmanCollection(FULL);
  const find = (name: string) => {
    const walk = (items: typeof a.collection.items): SatchelRequest | undefined => {
      for (const n of items) {
        if (n.type === "request" && n.request.name === name) return n.request;
        if (n.type === "folder") {
          const r = walk(n.children);
          if (r) return r;
        }
      }
      return undefined;
    };
    const r = walk(a.collection.items);
    if (!r) throw new Error(`no request ${name}`);
    return r;
  };

  it("counts requests, folders, variables and methods", () => {
    expect(a.stats).toEqual({ requests: 6, folders: 1, variables: 2, methods: { GET: 2, POST: 3, PUT: 1 } });
  });

  it("keeps enabled query params in the URL and disabled ones only in the table", () => {
    const r = find("List customers");
    expect(r.url).toBe("{{billingUrl}}/customers?limit=50");
    expect(r.params).toEqual([
      { key: "limit", value: "50", enabled: true },
      { key: "email", value: "ana@acme.test", enabled: false },
    ]);
  });

  it("reflects enabled query entries into a URL whose raw has no query string", () => {
    const b = analyzePostmanCollection({
      info: { name: "q" },
      item: [{ name: "x", request: { url: { raw: "https://a.test/x", query: [{ key: "a", value: "1" }] } } }],
    });
    const node = b.collection.items[0];
    if (node.type !== "request") throw new Error("expected request");
    expect(node.request.url).toBe("https://a.test/x?a=1");
    expect(node.request.params).toEqual([{ key: "a", value: "1", enabled: true }]);
  });

  it("maps url variables to path variables", () => {
    expect(find("Get customer").pathVariables).toEqual({ customerId: "cus_19" });
  });

  it("imports form-data with file fields that need to be re-picked", () => {
    expect(find("Attach PDF").body).toEqual({
      mode: "formdata",
      fields: [
        { key: "file", value: "", enabled: true, type: "file", fileName: "invoice-0042.pdf" },
        { key: "note", value: "Signed copy", enabled: false, type: "text" },
      ],
    });
    expect(a.fileFields).toBe(1);
  });

  it("converts GraphQL bodies to JSON { query, variables }", () => {
    const body = find("Usage (GraphQL)").body;
    if (body.mode !== "raw") throw new Error("expected raw");
    expect(body.language).toBe("json");
    expect(JSON.parse(body.raw)).toEqual({ query: "{ usage { total } }", variables: { month: "2026-09" } });
    expect(a.graphqlBodies).toBe(1);
  });

  it("copies collection auth to requests that inherit it; noauth and unsupported types become none", () => {
    expect(find("List customers").auth).toEqual({ type: "bearer", token: "{{billingToken}}" });
    expect(find("Attach PDF").auth).toEqual({ type: "bearer", token: "{{billingToken}}" });
    expect(find("OAuth token").auth).toEqual({ type: "none" });
    expect(find("Signed").auth).toEqual({ type: "none" });
    expect(a.inheritedAuth).toEqual({ type: "bearer", count: 4 });
    expect(a.unsupportedAuth).toEqual(["awsv4"]);
  });

  it("counts non-empty scripts at every level", () => {
    expect(a.scripts).toBe(2);
  });

  it("lists the variables the requests use", () => {
    expect(a.usedVariables).toEqual(["billingToken", "billingUrl"]);
  });

  it("reads v2.0 object-style auth params", () => {
    const b = analyzePostmanCollection({
      info: { name: "v2.0" },
      item: [{ name: "x", request: { url: "https://a.test", auth: { type: "basic", basic: { username: "u", password: "p" } } } }],
    });
    const node = b.collection.items[0];
    if (node.type !== "request") throw new Error("expected request");
    expect(node.request.auth).toEqual({ type: "basic", username: "u", password: "p" });
  });
});

describe("detectPostmanFile", () => {
  it("tells collections, environments and v1 exports apart", () => {
    expect(detectPostmanFile(FULL)).toBe("collection");
    expect(detectPostmanFile({ name: "Staging", values: [] })).toBe("environment");
    expect(detectPostmanFile({ id: "x", name: "Old", requests: [] })).toBe("v1");
    expect(detectPostmanFile({ foo: 1 })).toBe("unknown");
    expect(detectPostmanFile([1, 2])).toBe("unknown");
    expect(detectPostmanFile(null)).toBe("unknown");
  });
});

describe("parsePostmanEnvironment", () => {
  it("keeps only enabled values", () => {
    const env = parsePostmanEnvironment({
      name: "Acme Staging",
      _postman_variable_scope: "environment",
      values: [
        { key: "billingUrl", value: "https://staging.test", enabled: true },
        { key: "old", value: "x", enabled: false },
        { key: "port", value: 8080 },
      ],
    });
    expect(env.name).toBe("Acme Staging");
    expect(env.variables).toEqual([
      { key: "billingUrl", value: "https://staging.test", enabled: true },
      { key: "port", value: "8080", enabled: true },
    ]);
  });

  it("falls back to the file name", () => {
    expect(parsePostmanEnvironment({ values: [] }, "qa.postman_environment.json").name).toBe("qa");
  });
});
