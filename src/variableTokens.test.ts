import { describe, expect, it } from "vitest";
import { findVariable, isVariableResolved, splitVariableTokens } from "./variableTokens";

describe("splitVariableTokens", () => {
  it("splits plain text with no variables into a single run", () => {
    expect(splitVariableTokens("https://api.example.com/items")).toEqual([
      { text: "https://api.example.com/items", isVariable: false },
    ]);
  });

  it("splits text around one or more {{variables}}, including hyphenated/dotted names", () => {
    expect(splitVariableTokens("{{dotnetapi-local}}/items")).toEqual([
      { text: "{{dotnetapi-local}}", isVariable: true, key: "dotnetapi-local" },
      { text: "/items", isVariable: false },
    ]);

    expect(splitVariableTokens("https://{{api.host}}/{{resource}}")).toEqual([
      { text: "https://", isVariable: false },
      { text: "{{api.host}}", isVariable: true, key: "api.host" },
      { text: "/", isVariable: false },
      { text: "{{resource}}", isVariable: true, key: "resource" },
    ]);
  });

  it("handles an empty string without throwing", () => {
    expect(splitVariableTokens("")).toEqual([{ text: "", isVariable: false }]);
  });
});

describe("isVariableResolved", () => {
  it("is true only when a matching, enabled variable exists", () => {
    const vars = [
      { key: "host", value: "x", enabled: true },
      { key: "disabled", value: "x", enabled: false },
    ];
    expect(isVariableResolved("host", vars)).toBe(true);
    expect(isVariableResolved("disabled", vars)).toBe(false);
    expect(isVariableResolved("missing", vars)).toBe(false);
  });
});

describe("findVariable", () => {
  it("returns the matching enabled variable, powering the hover tooltip's value", () => {
    const vars = [{ key: "host", value: "api.example.com", enabled: true }];
    expect(findVariable("host", vars)).toEqual({ key: "host", value: "api.example.com", enabled: true });
  });

  it("returns undefined for a disabled or missing variable", () => {
    const vars = [{ key: "disabled", value: "x", enabled: false }];
    expect(findVariable("disabled", vars)).toBeUndefined();
    expect(findVariable("missing", vars)).toBeUndefined();
  });
});
