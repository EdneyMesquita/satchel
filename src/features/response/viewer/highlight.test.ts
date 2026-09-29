import { describe, expect, it } from "vitest";
import { tokenizeJsonLike } from "@/jsonTokens";
import { buildPieces } from "./highlight";

describe("buildPieces", () => {
  it("returns the runs unchanged without matches", () => {
    const runs = tokenizeJsonLike('{"a": 1}');
    expect(buildPieces(runs, []).map((p) => p.text).join("")).toBe('{"a": 1}');
    expect(buildPieces(runs, []).every((p) => p.match === -1)).toBe(true);
  });

  it("splits runs at match boundaries, keeping token kinds", () => {
    const text = '{"name": "Ada"}';
    const pieces = buildPieces(tokenizeJsonLike(text), [[2, 4], [10, 13]]);
    expect(pieces.map((p) => p.text).join("")).toBe(text);
    expect(pieces.filter((p) => p.match === 0)).toEqual([{ text: "na", kind: "key", match: 0 }]);
    expect(pieces.filter((p) => p.match === 1)).toEqual([{ text: "Ada", kind: "string", match: 1 }]);
  });

  it("gives every piece of a cross-token match the same index", () => {
    const text = '"a": 1';
    const pieces = buildPieces(tokenizeJsonLike(text), [[1, 6]]);
    expect(pieces.map((p) => p.text).join("")).toBe(text);
    const hit = pieces.filter((p) => p.match === 0);
    expect(hit.map((p) => p.text).join("")).toBe('a": 1');
    expect(new Set(hit.map((p) => p.kind)).size).toBeGreaterThan(1);
  });

  it("works on a single plain run", () => {
    const pieces = buildPieces([{ text: "hello hello", kind: "text" }], [[0, 5], [6, 11]]);
    expect(pieces.map((p) => [p.text, p.match])).toEqual([
      ["hello", 0],
      [" ", -1],
      ["hello", 1],
    ]);
  });
});
