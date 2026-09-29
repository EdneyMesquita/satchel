import { describe, expect, it } from "vitest";
import { fuzzyScore, groupRanked, rankItems, type Rankable } from "./rank";

const req = (label: string, sub = "Shop API · /products"): Rankable => ({ group: "Requests", label, sub, method: "GET" });
const cmd = (label: string, sub = ""): Rankable => ({ group: "Commands", label, sub });

describe("fuzzyScore", () => {
  it("scores substring, word prefix, subsequence", () => {
    expect(fuzzyScore("prod", "List products")).toBe(3);
    expect(fuzzyScore("li pr", "List products")).toBe(2);
    expect(fuzzyScore("lpd", "List products")).toBe(1);
    expect(fuzzyScore("zzz", "List products")).toBe(0);
  });
});

describe("rankItems", () => {
  const items = [
    ...Array.from({ length: 8 }, (_, i) => req(`Request ${i}`)),
    req("First order", "Shop API · /orders/first"),
    req("Health", "Shop API · /first-health"),
    cmd("New request", "Ctrl N"),
    cmd("Show first-run", "onboarding"),
  ];

  it("empty query: first 6 requests then every command", () => {
    const out = rankItems(items, "");
    expect(out.filter((i) => i.group === "Requests")).toHaveLength(6);
    expect(out.filter((i) => i.group === "Commands")).toHaveLength(2);
  });

  it("keeps only the best tier and puts label hits first", () => {
    const out = rankItems(items, "first");
    expect(out.map((i) => i.label)).toEqual(["First order", "Show first-run", "Health"]);
  });

  it("'first' ranks Show first-run first among commands", () => {
    const out = rankItems([req("Login"), cmd("New request"), cmd("Show first-run", "onboarding")], "first");
    expect(out[0].label).toBe("Show first-run");
  });
});

describe("groupRanked", () => {
  it("orders groups by their best item", () => {
    const groups = groupRanked([cmd("Show first-run"), req("Health")]);
    expect(groups.map((g) => g.group)).toEqual(["Commands", "Requests"]);
  });
});
