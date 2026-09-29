import { describe, expect, it } from "vitest";
import { cellText, findRecordLists, inferColumns, matchingRows, nextSort, sortedOrder, toCsv, VALUE_COLUMN } from "./tableModel";

describe("findRecordLists", () => {
  it("uses the root array of objects", () => {
    const [best] = findRecordLists([{ id: 1 }, { id: 2 }]);
    expect(best.path).toEqual([]);
    expect(best.rows).toHaveLength(2);
    expect(best.primitive).toBe(false);
  });

  it("finds envelopes and prefers object lists, shallow, then long", () => {
    const lists = findRecordLists({
      meta: { tags: ["a", "b", "c"] },
      data: [{ id: 1 }, { id: 2 }],
      included: { users: [{ id: 9 }, { id: 8 }, { id: 7 }] },
    });
    expect(lists.map((l) => l.path)).toEqual([["data"], ["included", "users"], ["meta", "tags"]]);
    expect(lists[2].primitive).toBe(true);
    expect(lists[2].rows[0]).toEqual({ [VALUE_COLUMN]: "a" });
  });

  it("ignores empty arrays, mixed arrays and nested arrays of arrays", () => {
    expect(findRecordLists({ a: [], b: [1, { x: 1 }, 2], c: [[1], [2]] })).toEqual([]);
    expect(findRecordLists("text")).toEqual([]);
  });
});

describe("inferColumns", () => {
  it("unions fields, puts ids and labels first and nested values last", () => {
    const cols = inferColumns([
      { address: { city: "x" }, email: "a@b", id: 1, active: true },
      { id: 2, createdAt: "2026-09-28T10:00:00Z", tags: [] },
    ]);
    expect(cols.map((c) => c.key)).toEqual(["id", "email", "active", "createdAt", "address", "tags"]);
    expect(cols.find((c) => c.key === "createdAt")?.type).toBe("date");
    expect(cols.find((c) => c.key === "address")?.type).toBe("object");
  });

  it("types from non-null values and marks disagreement as mixed", () => {
    const cols = inferColumns([{ a: null, b: 1 }, { a: "x", b: "y" }]);
    expect(cols).toEqual([
      { key: "a", type: "string" },
      { key: "b", type: "mixed" },
    ]);
  });
});

describe("cells", () => {
  it("summarizes containers and leaves missing blank", () => {
    expect(cellText({ a: 1, b: 2 })).toBe("{ 2 fields }");
    expect(cellText([1])).toBe("[ 1 item ]");
    expect(cellText(null)).toBe("null");
    expect(cellText(undefined)).toBe("");
  });
});

describe("sorting", () => {
  const rows = [{ n: 10, s: "b" }, { n: 2, s: "a10" }, { s: "a2" }, { n: null, s: "c" }];

  it("sorts numbers numerically and strings naturally, blanks last both ways", () => {
    expect(sortedOrder(rows, { key: "n", dir: "asc" })).toEqual([1, 0, 2, 3]);
    expect(sortedOrder(rows, { key: "n", dir: "desc" })).toEqual([0, 1, 2, 3]);
    expect(sortedOrder(rows, { key: "s", dir: "asc" })).toEqual([2, 1, 0, 3]);
    expect(sortedOrder(rows, null)).toEqual([0, 1, 2, 3]);
  });

  it("cycles asc → desc → off", () => {
    expect(nextSort(null, "n")).toEqual({ key: "n", dir: "asc" });
    expect(nextSort({ key: "n", dir: "asc" }, "n")).toEqual({ key: "n", dir: "desc" });
    expect(nextSort({ key: "n", dir: "desc" }, "n")).toBeNull();
    expect(nextSort({ key: "n", dir: "desc" }, "s")).toEqual({ key: "s", dir: "asc" });
  });
});

describe("matchingRows", () => {
  const rows = [
    { id: 1, name: "Leanne", address: { city: "Gwenborough" } },
    { id: 2, name: "Ervin", address: { city: "Wisokyburgh" } },
    { id: 3, name: "Clementine" },
  ];
  const cols = inferColumns(rows);

  it("matches values deep inside nested fields, by display position", () => {
    expect(matchingRows(rows, [0, 1, 2], cols, "wiso", "all")).toEqual([1]);
    expect(matchingRows(rows, [2, 1, 0], cols, "wiso", "all")).toEqual([1]);
    expect(matchingRows(rows, [0, 1, 2], cols, "EN", "values")).toEqual([0, 2]);
  });

  it("matches keys (columns and nested keys) in the keys scope", () => {
    expect(matchingRows(rows, [0, 1, 2], cols, "city", "keys")).toEqual([0, 1]);
    expect(matchingRows(rows, [0, 1, 2], cols, "Leanne", "keys")).toEqual([]);
  });
});

describe("toCsv", () => {
  it("quotes when needed and writes nested values as JSON", () => {
    const rows = [{ a: 'say "hi"', b: { x: 1 } }, { a: "one,two" }];
    expect(toCsv(rows, [0, 1], inferColumns(rows))).toBe('a,b\r\n"say ""hi""","{""x"":1}"\r\n"one,two",');
  });
});
