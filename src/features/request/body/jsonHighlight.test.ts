import { describe, expect, it } from "vitest";
import { jsonHighlightParts } from "./jsonHighlight";

describe("jsonHighlightParts", () => {
  it("colors JSON and splits variables inside strings and bare", () => {
    expect(jsonHighlightParts('{"id": "a{{id}}", "n": {{n}}}')).toEqual([
      { text: "{", className: "json-punct" },
      { text: '"id"', className: "json-key" },
      { text: ":", className: "json-punct" },
      { text: " ", className: undefined },
      { text: '"a', className: "json-string" },
      { text: "{{id}}", variable: "id" },
      { text: '"', className: "json-string" },
      { text: ",", className: "json-punct" },
      { text: " ", className: undefined },
      { text: '"n"', className: "json-key" },
      { text: ":", className: "json-punct" },
      { text: " ", className: undefined },
      { text: "{{n}}", variable: "n" },
      { text: "}", className: "json-punct" },
    ]);
  });
  it("round-trips the text", () => {
    const t = '[1, true, "x{{a}}y", {{b}}\n]';
    expect(jsonHighlightParts(t).map((p) => p.text).join("")).toBe(t);
  });
});
