import { describe, expect, it } from "vitest";
import { resolvedUrlSegments, resolvePlain, resolverFor, textSegments, urlSegments } from "./segments";

describe("textSegments", () => {
  it("splits {{variables}} out of plain text", () => {
    expect(textSegments("Bearer {{token}}")).toEqual([
      { kind: "text", text: "Bearer " },
      { kind: "var", text: "{{token}}", key: "token" },
    ]);
  });
  it("returns nothing for empty text", () => {
    expect(textSegments("")).toEqual([]);
  });
});

describe("urlSegments", () => {
  it("marks variables, path params and query separators", () => {
    expect(urlSegments("{{baseUrl}}/users/:id?expand=items&x")).toEqual([
      { kind: "var", text: "{{baseUrl}}", key: "baseUrl" },
      { kind: "text", text: "/users/" },
      { kind: "path", text: ":id", name: "id" },
      { kind: "qs", text: "?" },
      { kind: "text", text: "expand" },
      { kind: "qs", text: "=" },
      { kind: "text", text: "items" },
      { kind: "qs", text: "&" },
      { kind: "text", text: "x" },
    ]);
  });
  it("leaves = and & before the ? and :names after it as plain text", () => {
    expect(urlSegments("a=b&c?d=/:e")).toEqual([
      { kind: "text", text: "a=b&c" },
      { kind: "qs", text: "?" },
      { kind: "text", text: "d" },
      { kind: "qs", text: "=" },
      { kind: "text", text: "/:e" },
    ]);
  });
  it("concatenates back to the original text", () => {
    const url = "https://x.dev/:org/{{v}}/:id?q={{q}}&&=?";
    expect(urlSegments(url).map((s) => s.text).join("")).toBe(url);
  });
});

describe("resolvedUrlSegments", () => {
  const resolve = resolverFor([
    { key: "baseUrl", value: "http://localhost", enabled: true },
    { key: "org", value: "acme", enabled: true },
    { key: "off", value: "nope", enabled: false },
  ]);
  it("substitutes variables and path params, flagging missing ones", () => {
    expect(resolvedUrlSegments("{{baseUrl}}/:org/:id/{{off}}?a=:b", { org: "{{org}}-1", id: "" }, resolve)).toEqual([
      { kind: "var", key: "baseUrl", value: "http://localhost" },
      { kind: "text", text: "/" },
      { kind: "path", name: "org", value: "acme-1" },
      { kind: "text", text: "/" },
      { kind: "path", name: "id", value: undefined },
      { kind: "text", text: "/" },
      { kind: "var", key: "off", value: undefined },
      { kind: "text", text: "?a=:b" },
    ]);
  });
});

describe("resolvePlain", () => {
  it("keeps unknown variables literal", () => {
    expect(resolvePlain("{{a}}-{{b}}", (k) => (k === "a" ? "1" : undefined))).toBe("1-{{b}}");
  });
});
