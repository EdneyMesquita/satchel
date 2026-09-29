import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Workspace } from "./types";

// An in-memory disk behind the Tauri fs plugin: path → content, directories as a set.
const disk = new Map<string, string>();
const dirs = new Set<string>();
const parent = (p: string) => p.slice(0, p.lastIndexOf("/"));

vi.mock("@tauri-apps/plugin-fs", () => ({
  exists: async (p: string) => disk.has(p) || dirs.has(p),
  readTextFile: async (p: string) => {
    if (!disk.has(p)) throw new Error(`ENOENT ${p}`);
    return disk.get(p)!;
  },
  writeTextFile: async (p: string, c: string) => {
    if (!dirs.has(parent(p))) throw new Error(`no dir ${parent(p)}`);
    disk.set(p, c);
  },
  mkdir: async (p: string) => {
    for (let d = p; d.length > 1; d = parent(d)) dirs.add(d);
  },
  remove: async (p: string) => {
    if (!disk.delete(p) && !dirs.delete(p)) throw new Error(`ENOENT ${p}`);
  },
  readDir: async (p: string) => {
    if (!dirs.has(p)) throw new Error(`ENOENT ${p}`);
    const names = new Map<string, boolean>();
    for (const f of disk.keys()) if (parent(f) === p) names.set(f.slice(p.length + 1), false);
    for (const d of dirs) if (parent(d) === p) names.set(d.slice(p.length + 1), true);
    return [...names].map(([name, isDirectory]) => ({ name, isDirectory, isFile: !isDirectory, isSymlink: false }));
  },
}));

const { createWorkspaceFolder, openWorkspaceFolder, saveWorkspaceFolder } = await import("./folderStore");

const ROOT = "/repo";
const ws = (): Workspace => ({
  collections: [
    {
      id: "c1",
      name: "Shop",
      variables: [],
      items: [
        { type: "folder", id: "f1", name: "Auth", children: [{ type: "request", id: "r1", request: { id: "r1", name: "Login", method: "POST", url: "/login", params: [], pathVariables: {}, headers: [], auth: { type: "none" }, body: { mode: "none" } } }] },
      ],
    },
  ],
  environments: [{ id: "e1", name: "Local", variables: [] }],
  activeEnvironmentId: "e1",
  globals: [],
});

beforeEach(() => {
  disk.clear();
  dirs.clear();
  dirs.add(ROOT);
});

describe("workspace folders on disk", () => {
  it("creates a folder, then opens it back", async () => {
    await createWorkspaceFolder(ROOT, ws());
    expect(disk.has("/repo/collections/shop/auth/login.request.json")).toBe(true);
    const opened = await openWorkspaceFolder(ROOT);
    expect(opened.problems).toEqual([]);
    expect(opened.workspace).toEqual(ws());
  });

  it("leaves files it doesn't own alone while reading and saving", async () => {
    await createWorkspaceFolder(ROOT, ws());
    disk.set("/repo/README.md", "# team docs");
    dirs.add("/repo/.git");
    disk.set("/repo/.git/config", "[core]");
    const opened = await openWorkspaceFolder(ROOT);
    expect([...opened.files.keys()].some((p) => p.startsWith(".git/") || p === "README.md")).toBe(false);
    await saveWorkspaceFolder(ROOT, { ...ws(), collections: [] }, opened.files);
    expect(disk.get("/repo/README.md")).toBe("# team docs");
    expect(disk.has("/repo/.git/config")).toBe(true);
  });

  it("moves a renamed folder and removes the empty directory it left", async () => {
    const files = await createWorkspaceFolder(ROOT, ws());
    const renamed = ws();
    renamed.collections[0].items[0].type === "folder" && (renamed.collections[0].items[0].name = "Sessions");
    await saveWorkspaceFolder(ROOT, renamed, files);
    expect(disk.has("/repo/collections/shop/sessions/login.request.json")).toBe(true);
    expect(disk.has("/repo/collections/shop/auth/login.request.json")).toBe(false);
    expect(dirs.has("/repo/collections/shop/auth")).toBe(false);
    expect(dirs.has("/repo/collections/shop")).toBe(true);
  });

  it("refuses to create a workspace over an existing one", async () => {
    await createWorkspaceFolder(ROOT, ws());
    await expect(createWorkspaceFolder(ROOT, ws())).rejects.toThrow(/already has a Satchel workspace/);
  });

  it("keeps a conflicted file untouched through a save", async () => {
    await createWorkspaceFolder(ROOT, ws());
    const conflicted = "<<<<<<< HEAD\n{}\n=======\n{}\n>>>>>>> theirs\n";
    disk.set("/repo/collections/shop/auth/login.request.json", conflicted);
    const opened = await openWorkspaceFolder(ROOT);
    expect(opened.problems).toHaveLength(1);
    await saveWorkspaceFolder(ROOT, opened.workspace, opened.files, opened.protectedPaths);
    expect(disk.get("/repo/collections/shop/auth/login.request.json")).toBe(conflicted);
  });
});
