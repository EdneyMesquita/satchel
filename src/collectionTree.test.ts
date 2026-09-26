import { describe, expect, it } from "vitest";
import { resolveVariables } from "./collectionTree";

describe("resolveVariables", () => {
  it("substitutes a simple {{variable}}", () => {
    expect(resolveVariables("{{baseUrl}}/items", [{ key: "baseUrl", value: "https://api.test", enabled: true }])).toBe(
      "https://api.test/items",
    );
  });

  it("substitutes hyphenated and dotted variable names (regression: these look like real Postman exports, e.g. {{dotnetapi-local}})", () => {
    const vars = [{ key: "dotnetapi-local", value: "http://localhost:5000", enabled: true }];
    expect(resolveVariables("{{dotnetapi-local}}/items", vars)).toBe("http://localhost:5000/items");

    const dotted = [{ key: "api.host", value: "example.com", enabled: true }];
    expect(resolveVariables("https://{{api.host}}/x", dotted)).toBe("https://example.com/x");
  });

  it("leaves an unknown placeholder untouched instead of dropping it", () => {
    expect(resolveVariables("{{unknown}}/items", [])).toBe("{{unknown}}/items");
  });

  it("does not substitute a variable whose enabled flag is false", () => {
    const vars = [{ key: "token", value: "secret", enabled: false }];
    expect(resolveVariables("Bearer {{token}}", vars)).toBe("Bearer {{token}}");
  });

  it("first match wins, so callers encode precedence via array order (env before collection before globals)", () => {
    const vars = [
      { key: "host", value: "from-env", enabled: true },
      { key: "host", value: "from-collection", enabled: true },
      { key: "host", value: "from-globals", enabled: true },
    ];
    expect(resolveVariables("{{host}}", vars)).toBe("from-env");
  });
});
