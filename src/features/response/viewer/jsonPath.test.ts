import { describe, expect, it } from "vitest";
import { childId, displayPath, formatPath, looksLikePath, parsePath, resolvePath, resolvePathQuery, valueAt } from "./jsonPath";

const doc = { data: [{ name: "Ada", tags: ["x", "y"], "weird key": { x: 1 } }], "0": "zero", meta: { "content-type": "json" } };

describe("formatPath", () => {
  it("uses dots for identifiers, brackets for indices and odd keys", () => {
    expect(formatPath(["data", 0, "tags", 1])).toBe("data[0].tags[1]");
    expect(formatPath(["data", 0, "weird key", "x"])).toBe('data[0]["weird key"].x');
    expect(formatPath([3, "id"])).toBe("[3].id");
    expect(formatPath(["0"])).toBe('["0"]');
    expect(formatPath(["a.b"])).toBe('["a.b"]');
    expect(formatPath([])).toBe("");
    expect(displayPath([])).toBe("$");
  });

  it("builds the same id incrementally", () => {
    const id = ["data", 0, "weird key", "x"].reduce<string>((acc, seg) => childId(acc, seg as string | number), "");
    expect(id).toBe(formatPath(["data", 0, "weird key", "x"]));
  });
});

describe("looksLikePath", () => {
  it("accepts $ and dot prefixes and dotted/bracketed words", () => {
    expect(looksLikePath("$")).toBe(true);
    expect(looksLikePath(".name")).toBe(true);
    expect(looksLikePath("data[0].name")).toBe(true);
    expect(looksLikePath("a.b")).toBe(true);
  });
  it("rejects plain words and text with spaces", () => {
    expect(looksLikePath("name")).toBe(false);
    expect(looksLikePath("hello world.")).toBe(false);
    expect(looksLikePath("")).toBe(false);
  });
});

describe("parsePath", () => {
  it("parses dotted, bracketed and quoted segments", () => {
    expect(parsePath('$.data[0]["weird key"].x')).toEqual(["data", 0, "weird key", "x"]);
    expect(parsePath("data[0].tags[1]")).toEqual(["data", 0, "tags", 1]);
    expect(parsePath(".meta['content-type']")).toEqual(["meta", "content-type"]);
    expect(parsePath("$")).toEqual([]);
    expect(parsePath("[2]")).toEqual([2]);
  });
  it("returns null for malformed paths", () => {
    expect(parsePath("a..b")).toBeNull();
    expect(parsePath("a[")).toBeNull();
    expect(parsePath("a[x]")).toBeNull();
    expect(parsePath("$.")).toBeNull();
  });
});

describe("resolvePath", () => {
  it("resolves to a canonical path", () => {
    expect(resolvePath(doc, ["data", "0", "name"])).toEqual(["data", 0, "name"]);
    expect(resolvePath(doc, [0])).toEqual(["0"]);
    expect(resolvePath(doc, ["data", 5])).toBeNull();
    expect(resolvePath(doc, ["data", 0, "name", "x"])).toBeNull();
  });
  it("resolves free-form queries only when they look like paths", () => {
    expect(resolvePathQuery(doc, "data[0].tags[1]")).toEqual(["data", 0, "tags", 1]);
    expect(resolvePathQuery(doc, "data.0.name")).toEqual(["data", 0, "name"]);
    expect(resolvePathQuery(doc, "data")).toBeNull();
    expect(resolvePathQuery(doc, "$")).toEqual([]);
    expect(valueAt(doc, ["data", 0, "tags", 1])).toBe("y");
  });
});
