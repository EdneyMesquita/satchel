import { describe, expect, it } from "vitest";
import { beautifyJson, isJsonWithVariables } from "./json";

describe("beautifyJson", () => {
  it("pretty-prints with two spaces", () => {
    expect(beautifyJson('{"a":1,"b":[true,null]}')).toBe('{\n  "a": 1,\n  "b": [\n    true,\n    null\n  ]\n}');
  });
  it("keeps bare and quoted {{variables}}", () => {
    expect(beautifyJson('{"qty":{{qty}},"id":"{{id}}"}')).toBe('{\n  "qty": {{qty}},\n  "id": "{{id}}"\n}');
  });
  it("returns null for invalid JSON", () => {
    expect(beautifyJson('{"a":')).toBeNull();
  });
});

describe("isJsonWithVariables", () => {
  it("accepts JSON with bare variables and empty bodies", () => {
    expect(isJsonWithVariables('{"n": {{n}}}')).toBe(true);
    expect(isJsonWithVariables("  ")).toBe(true);
  });
  it("rejects broken JSON", () => {
    expect(isJsonWithVariables("{a: 1}")).toBe(false);
  });
});
