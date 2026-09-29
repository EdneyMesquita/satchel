import { describe, expect, it } from "vitest";
import { findRanges, searchText, searchTree } from "./jsonSearch";

const doc = { user: { name: "Ada Lovelace", nickname: "ada", age: 36 }, items: [{ id: 1, label: "Name tag" }, { id: 2, label: null }] };

describe("searchTree", () => {
  it("matches keys and values case-insensitively, in document order", () => {
    const r = searchTree(doc, "NAME", "all");
    expect(r.matches.map((m) => m.id)).toEqual(["user.name", "user.nickname", "items[0].label"]);
    expect(r.byPath).toBe(false);
  });
  it("respects the scope", () => {
    expect(searchTree(doc, "name", "keys").matches.map((m) => m.id)).toEqual(["user.name", "user.nickname"]);
    expect(searchTree(doc, "ada", "values").matches.map((m) => m.id)).toEqual(["user.name", "user.nickname"]);
    expect(searchTree(doc, "null", "values").matches.map((m) => m.id)).toEqual(["items[1].label"]);
    expect(searchTree(doc, "36", "keys").matches).toEqual([]);
  });
  it("treats a resolvable path as a single match", () => {
    const r = searchTree(doc, "items[1].id", "all");
    expect(r.byPath).toBe(true);
    expect(r.matches).toEqual([{ id: "items[1].id", path: ["items", 1, "id"] }]);
  });
  it("falls back to text search when the path doesn't resolve", () => {
    const r = searchTree({ v: "see a.b here" }, "a.b", "all");
    expect(r.byPath).toBe(false);
    expect(r.matches.map((m) => m.id)).toEqual(["v"]);
  });
  it("caps the number of matches", () => {
    const r = searchTree(Array.from({ length: 50 }, () => "x"), "x", "all", 10);
    expect(r.matches).toHaveLength(10);
    expect(r.capped).toBe(true);
  });
});

describe("findRanges", () => {
  it("finds non-overlapping case-insensitive ranges", () => {
    expect(findRanges("aAaA", "aa")).toEqual([[0, 2], [2, 4]]);
    expect(findRanges("a.b a+b", "a+b")).toEqual([[4, 7]]);
    expect(findRanges("abc", "")).toEqual([]);
  });
  it("can be limited to a window", () => {
    expect(findRanges("xx-xx-xx", "xx", 100, 3, 5)).toEqual([[3, 5]]);
  });
});

describe("searchText", () => {
  const text = '{\n  "name": "name here",\n  "count": 12,\n  "ok": true\n}';
  it("searches everything with the all scope", () => {
    expect(searchText(text, "name", "all", true)).toHaveLength(2);
  });
  it("only counts text inside keys with the keys scope", () => {
    const r = searchText(text, "name", "keys", true);
    expect(r).toEqual([[text.indexOf("name"), text.indexOf("name") + 4]]);
  });
  it("only counts value tokens with the values scope", () => {
    const r = searchText(text, "name", "values", true);
    expect(r).toEqual([[text.indexOf("name here"), text.indexOf("name here") + 4]]);
    expect(searchText(text, "12", "values", true)).toHaveLength(1);
    expect(searchText(text, "true", "values", true)).toHaveLength(1);
    expect(searchText(text, "ok", "values", true)).toHaveLength(0);
  });
  it("ignores the scope for non-JSON text", () => {
    expect(searchText("name: name", "name", "keys", false)).toHaveLength(2);
  });
});
