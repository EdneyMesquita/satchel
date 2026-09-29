import { describe, expect, it } from "vitest";
import type { Workspace } from "@/types";
import { analyzePostmanCollection } from "@/postman";
import {
  formatSize,
  importWarnings,
  knownVariables,
  plannedEnvironmentNames,
  readPostmanFiles,
  type AttachedEnvironment,
  type TextFile,
} from "./importModel";

const file = (name: string, content: unknown): TextFile => {
  const text = typeof content === "string" ? content : JSON.stringify(content);
  return { name, size: text.length, text: async () => text };
};

const COLLECTION = {
  info: { name: "Billing" },
  variable: [{ key: "billingUrl", value: "https://b.test" }],
  item: [{ name: "Me", request: { url: "{{billingUrl}}/me?k={{apiKey}}", header: [{ key: "X-Org", value: "{{org}}" }] } }],
};

const workspace = (over: Partial<Workspace> = {}): Workspace => ({
  collections: [],
  environments: [],
  activeEnvironmentId: null,
  globals: [],
  ...over,
});

describe("readPostmanFiles", () => {
  it("sorts collections, environments and problems", async () => {
    const result = await readPostmanFiles([
      file("staging.postman_environment.json", { name: "Staging", values: [{ key: "org", value: "acme", enabled: true }] }),
      file("billing.postman_collection.json", COLLECTION),
    ]);
    expect(result.error).toBeUndefined();
    expect(result.collection?.fileName).toBe("billing.postman_collection.json");
    expect(result.collection?.analysis.stats.requests).toBe(1);
    expect(result.environments.map((e) => e.environment.name)).toEqual(["Staging"]);
  });

  it("explains invalid JSON, v1 collections and unknown files", async () => {
    expect((await readPostmanFiles([file("a.json", "{nope")])).error).toBe("a.json isn't valid JSON.");
    expect((await readPostmanFiles([file("old.json", { name: "Old", requests: [] })])).error).toBe(
      "old.json is a Postman v1 collection. In Postman, export it again as Collection v2.1.",
    );
    expect((await readPostmanFiles([file("x.json", { hello: 1 })])).error).toBe(
      "x.json doesn't look like a Postman collection or environment export.",
    );
  });
});

describe("importWarnings", () => {
  const analysis = analyzePostmanCollection(COLLECTION);

  it("flags variables nothing defines", () => {
    const known = knownVariables(analysis, workspace({ globals: [{ key: "apiKey", value: "k", enabled: true }] }), [], { dest: "new" });
    expect(importWarnings(analysis, known)).toEqual([{ kind: "undefined", names: ["org"] }]);
  });

  it("counts attached environments and the merge target's variables as defined", () => {
    const attached: AttachedEnvironment[] = [
      { id: "1", fileName: "e.json", environment: { id: "1", name: "E", variables: [{ key: "org", value: "o", enabled: true }] } },
    ];
    const ws = workspace({ collections: [{ id: "c", name: "C", items: [], variables: [{ key: "apiKey", value: "", enabled: true }] }] });
    expect(importWarnings(analysis, knownVariables(analysis, ws, attached, { dest: "merge", into: "c" }))).toEqual([]);
    expect(importWarnings(analysis, knownVariables(analysis, ws, attached, { dest: "new" }))).toEqual([
      { kind: "undefined", names: ["apiKey"] },
    ]);
  });
});

describe("plannedEnvironmentNames", () => {
  it("de-duplicates against existing and earlier attached names", () => {
    const env = (name: string): AttachedEnvironment => ({ id: name, fileName: "", environment: { id: name, name, variables: [] } });
    expect(plannedEnvironmentNames(["Staging"], [env("Staging"), env("staging"), env("QA")])).toEqual(["Staging 2", "staging 3", "QA"]);
  });
});

describe("formatSize", () => {
  it("uses B / KB / MB", () => {
    expect(formatSize(512)).toBe("512 B");
    expect(formatSize(2048)).toBe("2.0 KB");
    expect(formatSize(3 * 1048576)).toBe("3.0 MB");
  });
});
