import { describe, expect, it } from "vitest";
import { emptyWorkspace, parseWorkspace, serializeWorkspace, WorkspaceFileError } from "./workspace";
import { createCollection, createEnvironment } from "./collectionTree";

describe("workspace serialization", () => {
  it("round-trips a populated workspace through serialize/parse", () => {
    const workspace = {
      collections: [createCollection("API")],
      environments: [createEnvironment("Local")],
      activeEnvironmentId: null,
      globals: [{ key: "apiVersion", value: "v1", enabled: true }],
    };
    const parsed = parseWorkspace(JSON.parse(serializeWorkspace(workspace)));
    expect(parsed).toEqual(workspace);
  });

  it("defaults missing environments/globals/activeEnvironmentId for older saved files", () => {
    const parsed = parseWorkspace({ collections: [] });
    expect(parsed).toEqual(emptyWorkspace());
  });

  it("rejects non-object input", () => {
    expect(() => parseWorkspace("nope")).toThrow(WorkspaceFileError);
    expect(() => parseWorkspace(null)).toThrow(WorkspaceFileError);
  });

  it("rejects a workspace with a malformed collections array", () => {
    expect(() => parseWorkspace({ collections: [{ id: "x" }] })).toThrow(WorkspaceFileError);
    expect(() => parseWorkspace({})).toThrow(WorkspaceFileError);
  });
});
