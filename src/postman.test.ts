import { describe, expect, it } from "vitest";
import { parsePostmanCollection, PostmanImportError } from "./postman";

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
