import { describe, expect, it } from "vitest";
import { CHUNK, allContainerIds, countNodes, defaultExpanded, flattenRows, parentIdOf, reveal, summarize } from "./treeModel";

const small = { a: { b: { c: { d: 1 } } }, list: [1, 2], s: "x" };

describe("countNodes", () => {
  it("counts every node including the root", () => {
    expect(countNodes(small)).toBe(9);
    expect(countNodes(5)).toBe(1);
  });
  it("stops early past the cap", () => {
    expect(countNodes(Array.from({ length: 1000 }, (_, i) => i), 10)).toBe(11);
  });
});

describe("defaultExpanded", () => {
  it("expands down to depth 2 for small documents", () => {
    expect([...defaultExpanded(small)].sort()).toEqual(["", "a", "a.b", "list"]);
  });
  it("expands only down to depth 1 for large documents", () => {
    const big = { groups: Array.from({ length: 3 }, () => ({ inner: { v: 1 }, xs: Array.from({ length: 800 }, (_, i) => i) })) };
    const e = defaultExpanded(big, 100_000);
    expect(e.has("groups")).toBe(true);
    expect(e.has("groups[0]")).toBe(false);
  });
  it("stops adding levels past the row budget", () => {
    const list = Array.from({ length: 30 }, (_, i) => ({ id: i, name: `n${i}`, x: 1, y: 2 }));
    const e = defaultExpanded(list, 50);
    expect([...e]).toEqual([""]);
  });
  it("expands nothing for primitives", () => {
    expect(defaultExpanded("x").size).toBe(0);
  });
});

describe("flattenRows", () => {
  it("lists visible rows with depth and ids", () => {
    const rows = flattenRows(small, new Set(["", "a"]));
    expect(rows.map((r) => [r.id, r.depth])).toEqual([
      ["a", 0],
      ["a.b", 1],
      ["list", 0],
      ["s", 0],
    ]);
  });
  it("renders a primitive root as a single keyless row", () => {
    const rows = flattenRows(42, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "node", segment: null, value: 42 });
  });
  it("chunks long containers with a more row", () => {
    const arr = Array.from({ length: 250 }, (_, i) => i);
    const rows = flattenRows(arr, new Set([""]));
    expect(rows).toHaveLength(CHUNK + 1);
    expect(rows[CHUNK]).toMatchObject({ kind: "more", parentId: "", remaining: 150 });
    expect(flattenRows(arr, new Set([""]), new Map([["", 200]]))).toHaveLength(201);
  });
});

describe("reveal", () => {
  it("expands ancestors and raises chunk limits to reach a path", () => {
    const doc = { xs: Array.from({ length: 300 }, (_, i) => ({ i })) };
    const { expanded, limits } = reveal(doc, ["xs", 250, "i"], new Set(), new Map());
    expect([...expanded]).toEqual(["", "xs", "xs[250]"]);
    expect(limits.get("xs")).toBe(300);
    const rows = flattenRows(doc, expanded, limits);
    expect(rows.some((r) => r.id === "xs[250].i")).toBe(true);
  });
});

describe("helpers", () => {
  it("finds the parent row", () => {
    const rows = flattenRows(small, new Set(["", "a", "a.b"]));
    expect(parentIdOf(rows, rows.findIndex((r) => r.id === "a.b.c"))).toBe("a.b");
    expect(parentIdOf(rows, 0)).toBeNull();
  });
  it("collects all container ids", () => {
    expect([...allContainerIds(small)].sort()).toEqual(["", "a", "a.b", "a.b.c", "list"]);
  });
  it("summarizes containers", () => {
    expect(summarize([1])).toBe("1 item");
    expect(summarize({ a: 1, b: 2 })).toBe("2 keys");
  });
});
