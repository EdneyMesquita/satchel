import { describe, expect, it } from "vitest";
import type { Workspace } from "@/types";
import { columnWidth, matrixColumns, matrixVariableNames, valueIn, VARIABLE_NAME } from "./matrixModel";

const kv = (key: string, value: string) => ({ key, value, enabled: true });

const ws: Workspace = {
  globals: [kv("timeout", "30")],
  collections: [{ id: "c1", name: "Shop API", items: [], variables: [kv("baseUrl", "https://shop.test")] }],
  environments: [
    { id: "e1", name: "Local", variables: [kv("baseUrl", "http://localhost:3000"), kv("token", "dev")] },
    { id: "e2", name: "Production", variables: [] },
  ],
  activeEnvironmentId: "e1",
};

describe("environment matrix model", () => {
  it("orders columns globals → collections → environments", () => {
    expect(matrixColumns(ws).map((c) => [c.key, c.group, c.label])).toEqual([
      ["g", "Workspace", "Globals"],
      ["c:c1", "Collection", "Shop API"],
      ["e:e1", "Environment", "Local"],
      ["e:e2", "Environment", "Production"],
    ]);
  });

  it("lists every variable once, sorted, including extra names", () => {
    expect(matrixVariableNames(ws, ["apiKey", "token"])).toEqual(["apiKey", "baseUrl", "timeout", "token"]);
  });

  it("sizes columns to fit, between 10 and 34 ch", () => {
    const [globals, collection, local] = matrixColumns(ws);
    const names = matrixVariableNames(ws);
    expect(columnWidth(globals, names)).toBe(10);
    expect(columnWidth(collection, names)).toBe("https://shop.test".length + 1);
    expect(valueIn(local, "token")).toBe("dev");
    expect(columnWidth({ ...local, variables: [kv("x", "y".repeat(80))] }, ["x"])).toBe(34);
  });

  it("accepts the same names {{variables}} use", () => {
    expect(VARIABLE_NAME.test("dotnetapi-local")).toBe(true);
    expect(VARIABLE_NAME.test("api.key_2")).toBe(true);
    expect(VARIABLE_NAME.test("has space")).toBe(false);
  });
});
