import { describe, expect, it } from "vitest";
import { hitIndex } from "./hitTest";

describe("hitIndex", () => {
  const rects = [
    { left: 10, right: 50, top: 0, bottom: 20 },
    { left: 60, right: 90, top: 0, bottom: 20 },
  ];
  it("finds the rect under the point, edges inclusive", () => {
    expect(hitIndex(rects, 10, 0)).toBe(0);
    expect(hitIndex(rects, 75, 10)).toBe(1);
    expect(hitIndex(rects, 90, 20)).toBe(1);
  });
  it("returns -1 between or outside rects", () => {
    expect(hitIndex(rects, 55, 10)).toBe(-1);
    expect(hitIndex(rects, 20, 21)).toBe(-1);
    expect(hitIndex([], 0, 0)).toBe(-1);
  });
});
