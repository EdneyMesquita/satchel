import { beforeEach, describe, expect, it } from "vitest";
import { fileMapsEqual, folderName, loadRecents, loadSource, MAX_RECENTS, storeRecents, storeSource, withoutRecent, withRecent } from "./sources";

// A minimal localStorage for the node test environment.
const store = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
  clear: () => store.clear(),
  key: () => null,
  length: 0,
} as Storage;

beforeEach(() => store.clear());

describe("workspace source", () => {
  it("defaults to the app cache", () => {
    expect(loadSource()).toEqual({ kind: "cache" });
  });

  it("migrates the path saved by builds before workspace folders", () => {
    store.set("satchel.filePath", "/home/dev/ws.json");
    expect(loadSource()).toEqual({ kind: "file", path: "/home/dev/ws.json" });
    storeSource({ kind: "folder", root: "/home/dev/shop" });
    expect(store.has("satchel.filePath")).toBe(false);
    expect(loadSource()).toEqual({ kind: "folder", root: "/home/dev/shop" });
  });

  it("forgets the source when going back to the cache, and survives junk", () => {
    storeSource({ kind: "folder", root: "/x" });
    storeSource({ kind: "cache" });
    expect(loadSource()).toEqual({ kind: "cache" });
    store.set("satchel.source", "{not json");
    expect(loadSource()).toEqual({ kind: "cache" });
  });
});

describe("recent folders", () => {
  it("moves a reopened folder to the front without duplicates (trailing slashes too)", () => {
    const list = withRecent(withRecent(withRecent([], "/a"), "/b"), "/a/");
    expect(list).toEqual(["/a/", "/b"]);
  });

  it("caps the list and removes entries", () => {
    let list: string[] = [];
    for (let i = 0; i < MAX_RECENTS + 3; i++) list = withRecent(list, `/r${i}`);
    expect(list).toHaveLength(MAX_RECENTS);
    expect(list[0]).toBe(`/r${MAX_RECENTS + 2}`);
    expect(withoutRecent(list, `/r${MAX_RECENTS + 2}/`)).toHaveLength(MAX_RECENTS - 1);
  });

  it("round-trips through storage and ignores junk entries", () => {
    storeRecents(["/a", "/b"]);
    expect(loadRecents()).toEqual(["/a", "/b"]);
    store.set("satchel.recentFolders", JSON.stringify(["/a", 3, null]));
    expect(loadRecents()).toEqual(["/a"]);
  });
});

describe("helpers", () => {
  it("compares file maps by content", () => {
    expect(fileMapsEqual(new Map([["a", "1"]]), new Map([["a", "1"]]))).toBe(true);
    expect(fileMapsEqual(new Map([["a", "1"]]), new Map([["a", "2"]]))).toBe(false);
    expect(fileMapsEqual(new Map([["a", "1"]]), new Map())).toBe(false);
  });

  it("names folders by their last segment", () => {
    expect(folderName("/home/dev/shop-api/")).toBe("shop-api");
    expect(folderName("C:\\dev\\shop-api")).toBe("shop-api");
  });
});
