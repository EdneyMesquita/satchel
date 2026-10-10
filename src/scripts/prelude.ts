/**
 * The `sat` API and `console`, defined inside the sandbox in plain JS. They only
 * read and change `__satIn` / `__satOut` (plain data that crosses as JSON), so
 * the VM has no function that reaches the app, the network or the disk.
 */
export const PRELUDE = String.raw`
(() => {
  const input = JSON.parse(globalThis.__SAT_INPUT);
  delete globalThis.__SAT_INPUT;
  const out = { logs: [], changes: [], request: null, response: null };
  globalThis.__satOut = out;

  const text = (v) => {
    if (typeof v === "string") return v;
    if (v === undefined) return "undefined";
    if (v instanceof Error) return v.name + ": " + v.message;
    try { return JSON.stringify(v); } catch { return String(v); }
  };
  const log = (level) => (...args) => { out.logs.push({ level, message: args.map(text).join(" ") }); };
  globalThis.console = { log: log("log"), info: log("info"), warn: log("warn"), error: log("error"), debug: log("log") };

  const unavailable = (what, why) => function () { throw new Error(what + " isn't available in scripts: " + why + "."); };
  globalThis.fetch = unavailable("fetch", "they can't make network requests");
  globalThis.XMLHttpRequest = unavailable("XMLHttpRequest", "they can't make network requests");
  globalThis.WebSocket = unavailable("WebSocket", "they can't make network requests");
  globalThis.setTimeout = unavailable("setTimeout", "they run once, start to finish");
  globalThis.setInterval = unavailable("setInterval", "they run once, start to finish");
  globalThis.require = unavailable("require", "there are no packages");

  const env = input.environment;
  const collection = input.collection;
  const globals = input.globals;
  const resolve = (k) => env.values[k] ?? collection[k] ?? globals[k];
  const record = (scope, key, value) => {
    out.changes.push({ scope, key, value });
    const where = scope === "environment" ? "env" : "globals";
    out.logs.push({ level: "variable", message: where + (value === null ? ".unset " : ".set ") + key + (scope === "environment" ? " (" + env.name + ")" : "") });
  };
  const needEnv = () => { if (env.name === null) throw new Error("No environment is active. Pick one, or use sat.globals.set()."); };

  const headers = (list, writable) => ({
    get(name) { const n = String(name).toLowerCase(); const h = list.find((x) => x[0].toLowerCase() === n); return h ? h[1] : undefined; },
    has(name) { return this.get(name) !== undefined; },
    toObject() { return Object.fromEntries(list); },
    ...(writable ? {
      set(name, value) {
        const n = String(name), v = String(value), i = list.findIndex((x) => x[0].toLowerCase() === n.toLowerCase());
        if (i >= 0) list[i] = [list[i][0], v]; else list.push([n, v]);
      },
      remove(name) { const n = String(name).toLowerCase(); for (let i = list.length - 1; i >= 0; i--) if (list[i][0].toLowerCase() === n) list.splice(i, 1); },
    } : {}),
  });

  const sat = {
    env: {
      get name() { return env.name; },
      get(key) { return env.values[String(key)]; },
      set(key, value) { needEnv(); const k = String(key), v = String(value); env.values[k] = v; record("environment", k, v); },
      unset(key) { needEnv(); const k = String(key); delete env.values[k]; record("environment", k, null); },
    },
    globals: {
      get(key) { return globals[String(key)]; },
      set(key, value) { const k = String(key), v = String(value); globals[k] = v; record("globals", k, v); },
      unset(key) { const k = String(key); delete globals[k]; record("globals", k, null); },
    },
    variables: { get(key) { return resolve(String(key)); } },
  };

  const req = input.request;
  const pre = input.phase === "pre";
  const queryOf = () => { const i = req.url.indexOf("?"); return i < 0 ? [] : req.url.slice(i + 1).split("&").filter(Boolean).map((p) => { const j = p.indexOf("="); return j < 0 ? [p, ""] : [p.slice(0, j), p.slice(j + 1)]; }); };
  const setQuery = (pairs) => { const i = req.url.indexOf("?"), base = i < 0 ? req.url : req.url.slice(0, i); req.url = pairs.length ? base + "?" + pairs.map(([k, v]) => (v !== "" ? k + "=" + v : k)).join("&") : base; };
  const readOnly = (what) => () => { throw new Error(what + " can only be changed in the pre-request script."); };
  const setBody = (body, json) => {
    if (req.bodyMode === "other") throw new Error("This request's body is form data or URL-encoded: scripts can only change raw bodies.");
    req.body = body; req.bodyMode = "raw"; req.json = json;
  };
  sat.request = {
    get method() { return req.method; },
    set method(v) { if (!pre) readOnly("The request")(); req.method = String(v).toUpperCase(); },
    get url() { return req.url; },
    set url(v) { if (!pre) readOnly("The request")(); req.url = String(v); },
    headers: headers(req.headers, pre),
    query: {
      get(key) { const p = queryOf().find(([k]) => k === String(key)); return p ? p[1] : undefined; },
      set: pre ? (key, value) => { const k = String(key), v = String(value), pairs = queryOf(), i = pairs.findIndex(([x]) => x === k); if (i >= 0) pairs[i] = [k, v]; else pairs.push([k, v]); setQuery(pairs); } : readOnly("The query"),
      remove: pre ? (key) => setQuery(queryOf().filter(([k]) => k !== String(key))) : readOnly("The query"),
    },
    get body() { return req.body; },
    set body(v) { if (!pre) readOnly("The body")(); setBody(v === null ? null : String(v), false); },
    json() { return JSON.parse(req.body ?? ""); },
    setJson: pre ? (value) => setBody(JSON.stringify(value, null, 2), true) : readOnly("The body"),
  };
  if (pre) out.request = req;

  if (input.response) {
    const res = input.response;
    let body = res.body;
    sat.response = {
      get status() { return res.status; },
      get statusText() { return res.statusText; },
      get timeMs() { return res.timeMs; },
      headers: headers(res.headers, false),
      text() { return body; },
      json() { return JSON.parse(body); },
      setJson(value) { body = JSON.stringify(value, null, 2); out.response = { body, json: true }; },
      setBody(value) { body = String(value); out.response = { body, json: false }; },
    };
  }
  globalThis.sat = sat;
})();
`;
