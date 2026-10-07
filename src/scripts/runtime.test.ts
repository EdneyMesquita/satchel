import { beforeAll, describe, expect, it } from "vitest";
import type { QuickJSWASMModule } from "quickjs-emscripten-core";
import { loadQuickJS } from "./engine";
import { runInQuickJS } from "./runtime";
import type { ScriptInput } from "./types";

let qjs: QuickJSWASMModule;
beforeAll(async () => {
  qjs = await loadQuickJS();
});

const input = (code: string, over: Partial<ScriptInput> = {}): ScriptInput => ({
  phase: "pre",
  code,
  environment: { name: "Staging", values: { baseUrl: "https://staging.test", token: "t1" } },
  collection: { apiVersion: "v2", baseUrl: "http://collection" },
  globals: { userAgent: "satchel" },
  request: { method: "GET", url: "{{baseUrl}}/orders?limit=20", headers: [["Accept", "application/json"]], body: null, bodyMode: "none" },
  ...over,
});
const run = (code: string, over?: Partial<ScriptInput>) => runInQuickJS(qjs, input(code, over));

describe("scripts", () => {
  it("reads and writes variables, recording each write", () => {
    const r = run(`
      console.log(sat.env.name, sat.env.get("token"), sat.variables.get("apiVersion"), sat.variables.get("baseUrl"));
      sat.env.set("token", "t2");
      sat.globals.set("lastRun", 42);
      sat.env.unset("baseUrl");
      console.log(sat.variables.get("baseUrl"));
    `);
    expect(r.error).toBeUndefined();
    expect(r.changes).toEqual([
      { scope: "environment", key: "token", value: "t2" },
      { scope: "globals", key: "lastRun", value: "42" },
      { scope: "environment", key: "baseUrl", value: null },
    ]);
    expect(r.logs.map((l) => l.message)).toEqual([
      "Staging t1 v2 https://staging.test",
      "env.set token (Staging)",
      "globals.set lastRun",
      "env.unset baseUrl (Staging)",
      "http://collection",
    ]);
  });

  it("changes the request before it's sent: headers, query, method, body", () => {
    const r = run(`
      sat.request.headers.set("X-Trace", "abc");
      sat.request.headers.set("accept", "text/plain");
      sat.request.query.set("limit", "{{pageSize}}");
      sat.request.query.set("sort", "-created");
      sat.request.query.remove("missing");
      sat.request.method = "post";
      sat.request.setJson({ hello: "world" });
    `);
    expect(r.error).toBeUndefined();
    expect(r.request).toMatchObject({
      method: "POST",
      url: "{{baseUrl}}/orders?limit={{pageSize}}&sort=-created",
      headers: [["Accept", "text/plain"], ["X-Trace", "abc"]],
      body: '{\n  "hello": "world"\n}',
      bodyMode: "raw",
      json: true,
    });
  });

  it("reshapes the response after it arrives", () => {
    const r = run(`const { data } = sat.response.json(); sat.response.setJson(data.map((d) => d.id));`, {
      phase: "post",
      response: { status: 200, statusText: "OK", timeMs: 12, headers: [["content-type", "application/json"]], body: '{"data":[{"id":1},{"id":2}]}' },
    });
    expect(r.error).toBeUndefined();
    expect(r.response).toEqual({ body: "[\n  1,\n  2\n]", json: true });
  });

  it("can't change the request after it was sent", () => {
    const r = run(`sat.request.headers.set("X", "1")`, {
      phase: "post",
      response: { status: 200, statusText: "OK", timeMs: 1, headers: [], body: "" },
    });
    expect(r.error?.message).toMatch(/not a function|set/);
  });

  it("reports the line of an error and keeps what ran before it", () => {
    const r = run(`console.log("first");\nsat.env.set("a", "1");\nconst x = undefinedThing.y;`);
    expect(r.error).toEqual({ message: expect.stringMatching(/ReferenceError/), line: 3 });
    expect(r.changes).toEqual([{ scope: "environment", key: "a", value: "1" }]);
    expect(r.logs[r.logs.length - 1]).toMatchObject({ level: "error" });
  });

  it("has no network, timers or packages", () => {
    for (const code of [`fetch("https://example.com")`, `new XMLHttpRequest()`, `setTimeout(() => {}, 1)`, `require("axios")`]) {
      expect(run(code).error?.message).toMatch(/isn't available in scripts/);
    }
  });

  it("refuses env writes when no environment is active", () => {
    const r = run(`sat.env.set("token", "x")`, { environment: { name: null, values: {} } });
    expect(r.error?.message).toMatch(/No environment is active/);
  });

  it("stops a script that runs too long", () => {
    expect(run(`while (true) {}`).error?.message).toMatch(/more than 1 s/);
  });

  it("can't take more memory than the engine is given", async () => {
    // A small engine, so filling it is quick; the app's is capped at 256 MiB.
    const small = await loadQuickJS(undefined, 512);
    // Either QuickJS reports it, or the engine aborts (and the worker loads a new one).
    let message = "";
    try {
      message = runInQuickJS(small, input(`const a = []; while (true) a.push("x".repeat(1e6));`)).error?.message ?? "";
    } catch (err) {
      message = String(err);
    }
    expect(message).toMatch(/memory|abort/i);
    // and the next run, on a new engine, is fine
    expect(run(`console.log("ok")`).logs[0].message).toBe("ok");
  });

  it("starts every run fresh", () => {
    run(`globalThis.leak = 1; sat.env.set("token", "changed")`);
    const r = run(`console.log(typeof globalThis.leak, sat.env.get("token"))`);
    expect(r.logs[0].message).toBe("undefined t1");
  });
});
