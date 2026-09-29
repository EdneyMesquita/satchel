import { describe, expect, it } from "vitest";
import { mergedVariables, resolveVariable, setVariable, type VariableContext } from "./variables";

const ctx: VariableContext = {
  environment: { id: "e", name: "Local", variables: [{ key: "baseUrl", value: "http://localhost:8080", enabled: true }, { key: "off", value: "x", enabled: false }] },
  collection: { id: "c", name: "Shop API", items: [], variables: [{ key: "baseUrl", value: "https://api.shop.dev", enabled: true }, { key: "pageSize", value: "20", enabled: true }] },
  globals: [{ key: "userAgent", value: "satchel", enabled: true }],
};

describe("resolveVariable", () => {
  it("prefers environment over collection over globals and reports the chain", () => {
    const r = resolveVariable("baseUrl", ctx);
    expect(r.winner).toBe(0);
    expect(r.value).toBe("http://localhost:8080");
    expect(r.chain.map((c) => c.value)).toEqual(["http://localhost:8080", "https://api.shop.dev", undefined]);
    expect(resolveVariable("pageSize", ctx).winner).toBe(1);
    expect(resolveVariable("userAgent", ctx).winner).toBe(2);
  });

  it("treats disabled and missing variables as unresolved", () => {
    expect(resolveVariable("off", ctx).winner).toBe(-1);
    expect(resolveVariable("nope", ctx).value).toBeUndefined();
  });

  it("merges in precedence order for substitution", () => {
    expect(mergedVariables(ctx).map((v) => v.key)).toEqual(["baseUrl", "baseUrl", "pageSize", "userAgent"]);
  });
});

describe("setVariable", () => {
  it("adds, updates and removes immutably", () => {
    const list = [{ key: "a", value: "1", enabled: true }];
    expect(setVariable(list, "b", "2")).toHaveLength(2);
    expect(setVariable(list, "a", "9")[0].value).toBe("9");
    expect(setVariable(list, "a", null)).toEqual([]);
    expect(list[0].value).toBe("1");
  });
});
