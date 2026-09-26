import { describe, expect, it } from "vitest";
import { parseCurl, CurlParseError } from "./curl";

describe("parseCurl", () => {
  it("parses a multi-line POST with headers and a JSON body (Chrome's 'Copy as cURL (bash)' shape)", () => {
    const cmd = `curl -X POST 'https://jsonplaceholder.typicode.com/posts' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer abc123' \\
  -d '{"title":"hello","body":"world","userId":1}'`;

    const parsed = parseCurl(cmd);
    expect(parsed.method).toBe("POST");
    expect(parsed.url).toBe("https://jsonplaceholder.typicode.com/posts");
    expect(parsed.headers).toEqual([
      { key: "Content-Type", value: "application/json", enabled: true },
      { key: "Authorization", value: "Bearer abc123", enabled: true },
    ]);
    expect(parsed.body).toEqual({ mode: "raw", raw: '{"title":"hello","body":"world","userId":1}', language: "json" });
  });

  it("infers GET and keeps the query string when there's no method flag", () => {
    const parsed = parseCurl("curl 'https://api.example.com/v1/items?limit=10' -H 'X-Api-Key: abc-def-123'");
    expect(parsed.method).toBe("GET");
    expect(parsed.url).toBe("https://api.example.com/v1/items?limit=10");
    expect(parsed.headers).toEqual([{ key: "X-Api-Key", value: "abc-def-123", enabled: true }]);
  });

  it("infers POST when a body is present but -X is omitted", () => {
    const parsed = parseCurl("curl https://api.example.com/items -d 'name=foo'");
    expect(parsed.method).toBe("POST");
  });

  it("parses basic auth from -u", () => {
    const parsed = parseCurl("curl -u alice:hunter2 https://api.example.com/secure");
    expect(parsed.auth).toEqual({ type: "basic", username: "alice", password: "hunter2" });
  });

  it("parses x-www-form-urlencoded bodies into key/value pairs", () => {
    const parsed = parseCurl(
      "curl -X POST https://api.example.com/login -H 'Content-Type: application/x-www-form-urlencoded' -d 'user=alice&pass=hunter2'",
    );
    expect(parsed.body).toEqual({
      mode: "urlencoded",
      params: [
        { key: "user", value: "alice", enabled: true },
        { key: "pass", value: "hunter2", enabled: true },
      ],
    });
  });

  it("rejects input that isn't a curl command", () => {
    expect(() => parseCurl("not a curl command")).toThrow(CurlParseError);
    expect(() => parseCurl("")).toThrow(CurlParseError);
  });

  it("rejects a curl command with no discoverable URL", () => {
    expect(() => parseCurl("curl -X GET -H 'Accept: json'")).toThrow(CurlParseError);
  });
});
