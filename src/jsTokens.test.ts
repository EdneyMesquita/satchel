import { describe, expect, it } from "vitest";
import { tokenizeJs, type JsRun } from "./jsTokens";

const tokens = (runs: JsRun[]) => runs.filter((r) => r.kind !== "text").map((r) => [r.text, r.kind]);

describe("tokenizeJs", () => {
  it("classifies keywords, strings, numbers and the sat/console globals", () => {
    const src = `const n = sat.env.get("n") ?? 'x';\nif (n > 1.5) console.log(n);`;
    expect(tokens(tokenizeJs(src))).toEqual([
      ["const", "keyword"],
      ["sat", "global"],
      ['"n"', "string"],
      ["'x'", "string"],
      ["if", "keyword"],
      ["1.5", "number"],
      ["console", "global"],
    ]);
  });

  it("concatenates back to the input", () => {
    const src = "/* a\n b */ let s = `x\n${1}`; // end\nreturn 'q\\'r';\n";
    expect(tokenizeJs(src).map((r) => r.text).join("")).toBe(src);
  });

  it("keeps a block comment spanning lines in one run", () => {
    const runs = tokenizeJs("/* one\n * two\n */\nlet a;");
    expect(runs[0]).toEqual({ text: "/* one\n * two\n */", kind: "comment" });
    expect(tokens(runs)).toContainEqual(["let", "keyword"]);
  });

  it("runs an unterminated block comment to the end", () => {
    expect(tokens(tokenizeJs("let a; /* not\nclosed const"))).toEqual([
      ["let", "keyword"],
      ["/* not\nclosed const", "comment"],
    ]);
  });

  it("keeps a template literal spanning lines in one run, including ${…} and escaped backticks", () => {
    const src = "const msg = `line one\nline ${two} \\` three`;\nconst x = 1;";
    expect(tokens(tokenizeJs(src))).toEqual([
      ["const", "keyword"],
      ["`line one\nline ${two} \\` three`", "string"],
      ["const", "keyword"],
      ["1", "number"],
    ]);
  });

  it("runs an unterminated template literal to the end", () => {
    expect(tokens(tokenizeJs("let t = `open\nconst x"))).toEqual([
      ["let", "keyword"],
      ["`open\nconst x", "string"],
    ]);
  });

  it("ends a line comment at the newline", () => {
    expect(tokens(tokenizeJs("// const a\nconst b"))).toEqual([
      ["// const a", "comment"],
      ["const", "keyword"],
    ]);
  });

  it("doesn't read comment markers inside strings", () => {
    expect(tokens(tokenizeJs(`"a//b" + '/* x */'`))).toEqual([
      ['"a//b"', "string"],
      ["'/* x */'", "string"],
    ]);
  });

  it("stops an unterminated quoted string at the end of its line", () => {
    expect(tokens(tokenizeJs(`"open\nlet x`))).toEqual([
      ['"open', "string"],
      ["let", "keyword"],
    ]);
  });

  it("doesn't color keywords inside identifiers or property names", () => {
    expect(tokens(tokenizeJs("constant; json.delete(); a?.new; sat.console; x1 = 2"))).toEqual([
      ["sat", "global"],
      ["2", "number"],
    ]);
  });

  it("still colors a spread operand", () => {
    expect(tokens(tokenizeJs("f(...sat)"))).toEqual([["sat", "global"]]);
  });

  it("colors delete before a property access", () => {
    expect(tokens(tokenizeJs("delete json.meta;"))).toEqual([["delete", "keyword"]]);
  });
});
