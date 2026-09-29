import { describe, expect, it } from "vitest";
import { formatSize, statusTone } from "./format";

describe("formatSize", () => {
  it("formats bytes, kilobytes and megabytes", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(1023)).toBe("1023 B");
    expect(formatSize(1536)).toBe("1.5 KB");
    expect(formatSize(2 * 1048576)).toBe("2.0 MB");
  });
});

describe("statusTone", () => {
  it("maps status classes to pill tones", () => {
    expect(statusTone(200)).toBe("ok");
    expect(statusTone(204)).toBe("ok");
    expect(statusTone(304)).toBe("redirect");
    expect(statusTone(404)).toBe("client");
    expect(statusTone(429)).toBe("error");
    expect(statusTone(503)).toBe("error");
  });
});
