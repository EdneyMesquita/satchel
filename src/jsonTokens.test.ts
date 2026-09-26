import { describe, expect, it } from "vitest";
import { tokenizeJsonLike } from "./jsonTokens";

describe("tokenizeJsonLike", () => {
  it("classifies a quoted string immediately before ':' as a key, otherwise as a string", () => {
    const runs = tokenizeJsonLike('{"title": "hi"}');
    expect(runs).toEqual([
      { text: "{", kind: "punct" },
      { text: '"title"', kind: "key" },
      { text: ":", kind: "punct" },
      { text: " ", kind: "text" },
      { text: '"hi"', kind: "string" },
      { text: "}", kind: "punct" },
    ]);
  });

  it("classifies numbers, booleans, and null distinctly from strings", () => {
    const runs = tokenizeJsonLike('{"n": 3.5, "ok": true, "x": null}');
    const kinds = runs.filter((r) => r.kind !== "text").map((r) => [r.text, r.kind]);
    expect(kinds).toEqual([
      ["{", "punct"],
      ['"n"', "key"],
      [":", "punct"],
      ["3.5", "number"],
      [",", "punct"],
      ['"ok"', "key"],
      [":", "punct"],
      ["true", "literal"],
      [",", "punct"],
      ['"x"', "key"],
      [":", "punct"],
      ["null", "literal"],
      ["}", "punct"],
    ]);
  });

  it("still classifies a key when whitespace separates it from the colon", () => {
    const runs = tokenizeJsonLike('"title"   :"hi"');
    expect(runs[0]).toEqual({ text: '"title"', kind: "key" });
  });

  it("doesn't choke on invalid/incomplete JSON (still mid-edit)", () => {
    expect(() => tokenizeJsonLike('{"title": "unterminated')).not.toThrow();
  });

  it("leaves plain, non-JSON text as a single text run", () => {
    expect(tokenizeJsonLike("hello world")).toEqual([{ text: "hello world", kind: "text" }]);
  });
});
