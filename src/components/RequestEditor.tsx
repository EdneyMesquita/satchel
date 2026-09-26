import { useState } from "react";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { AuthConfig, HttpMethod, KeyValue, RequestBody, SatchelRequest } from "../types";
import { resolveVariables } from "../collectionTree";
import { isTauri } from "../platform";
import { parseCurl } from "../curl";
import { KvEditor } from "./KvEditor";
import { VariableInput, VariableTextarea } from "./VariableField";

interface RequestEditorProps {
  request: SatchelRequest;
  variables: KeyValue[];
  onChange: (updater: (request: SatchelRequest) => SatchelRequest) => void;
}

interface ResponseState {
  status: number;
  ok: boolean;
  timeMs: number;
  sizeBytes: number;
  headers: [string, string][];
  bodyText: string;
}

const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"];
type Tab = "params" | "headers" | "body" | "auth";

export function buildHeaders(request: SatchelRequest, variables: KeyValue[]): Headers {
  const headers = new Headers();
  for (const h of request.headers) {
    if (h.enabled && h.key) headers.set(h.key, resolveVariables(h.value, variables));
  }
  const auth = request.auth;
  if (auth.type === "bearer" && auth.token) headers.set("Authorization", `Bearer ${resolveVariables(auth.token, variables)}`);
  if (auth.type === "basic" && auth.username) {
    const user = resolveVariables(auth.username, variables);
    const pass = resolveVariables(auth.password, variables);
    headers.set("Authorization", `Basic ${btoa(`${user}:${pass}`)}`);
  }
  if (auth.type === "apikey" && auth.in === "header" && auth.key) headers.set(auth.key, resolveVariables(auth.value, variables));
  return headers;
}

export function buildUrl(request: SatchelRequest, variables: KeyValue[]): string {
  const resolved = resolveVariables(request.url, variables);
  const url = new URL(resolved.startsWith("http") ? resolved : `https://${resolved}`);
  for (const p of request.params) {
    if (p.enabled && p.key) url.searchParams.set(p.key, resolveVariables(p.value, variables));
  }
  if (request.auth.type === "apikey" && request.auth.in === "query" && request.auth.key) {
    url.searchParams.set(request.auth.key, resolveVariables(request.auth.value, variables));
  }
  return url.toString();
}

export function buildBody(request: SatchelRequest, variables: KeyValue[]): string | undefined {
  if (request.body.mode === "raw") return resolveVariables(request.body.raw, variables);
  if (request.body.mode === "urlencoded") {
    return new URLSearchParams(
      request.body.params.filter((p) => p.enabled).map((p) => [p.key, resolveVariables(p.value, variables)]),
    ).toString();
  }
  return undefined;
}

function AuthEditor({ auth, onChange, variables }: { auth: AuthConfig; onChange: (auth: AuthConfig) => void; variables: KeyValue[] }) {
  return (
    <div className="panel">
      <select value={auth.type} onChange={(e) => onChange(authOfType(e.target.value as AuthConfig["type"]))}>
        <option value="none">No Auth</option>
        <option value="bearer">Bearer Token</option>
        <option value="basic">Basic Auth</option>
        <option value="apikey">API Key</option>
      </select>
      {auth.type === "bearer" && (
        <div className="auth-row">
          <span className="field-label">Token</span>
          <VariableInput className="auth-field" value={auth.token} variables={variables} onChange={(token) => onChange({ ...auth, token })} />
        </div>
      )}
      {auth.type === "basic" && (
        <div className="auth-row">
          <VariableInput className="auth-field" placeholder="Username" value={auth.username} variables={variables} onChange={(username) => onChange({ ...auth, username })} />
          {/* Plain input, not VariableInput: password masking relies on the native
              field's own text being visible (as dots) — our overlay makes native
              text transparent, which would unmask the value through the backdrop. */}
          <input placeholder="Password" type="password" value={auth.password} onChange={(e) => onChange({ ...auth, password: e.target.value })} />
        </div>
      )}
      {auth.type === "apikey" && (
        <div className="auth-row">
          <VariableInput className="auth-field" placeholder="Key" value={auth.key} variables={variables} onChange={(key) => onChange({ ...auth, key })} />
          <VariableInput className="auth-field" placeholder="Value" value={auth.value} variables={variables} onChange={(value) => onChange({ ...auth, value })} />
          <select value={auth.in} onChange={(e) => onChange({ ...auth, in: e.target.value as "header" | "query" })}>
            <option value="header">Header</option>
            <option value="query">Query Param</option>
          </select>
        </div>
      )}
    </div>
  );
}

function authOfType(type: AuthConfig["type"]): AuthConfig {
  switch (type) {
    case "bearer":
      return { type: "bearer", token: "" };
    case "basic":
      return { type: "basic", username: "", password: "" };
    case "apikey":
      return { type: "apikey", key: "", value: "", in: "header" };
    default:
      return { type: "none" };
  }
}

function BodyEditor({ body, onChange, variables }: { body: RequestBody; onChange: (body: RequestBody) => void; variables: KeyValue[] }) {
  const [beautifyError, setBeautifyError] = useState(false);

  const beautify = () => {
    if (body.mode !== "raw") return;
    try {
      const formatted = JSON.stringify(JSON.parse(body.raw), null, 2);
      onChange({ ...body, raw: formatted, language: "json" });
      setBeautifyError(false);
    } catch {
      setBeautifyError(true);
    }
  };

  return (
    <div className="panel">
      <div className="body-mode-row">
        <select
          value={body.mode}
          onChange={(e) => {
            const mode = e.target.value as RequestBody["mode"];
            if (mode === "raw") onChange({ mode: "raw", raw: "", language: "json" });
            else if (mode === "urlencoded") onChange({ mode: "urlencoded", params: [] });
            else onChange({ mode: "none" });
          }}
        >
          <option value="none">None</option>
          <option value="raw">Raw (JSON)</option>
          <option value="urlencoded">x-www-form-urlencoded</option>
        </select>
        {body.mode === "raw" && (
          <button
            className="beautify-btn"
            onClick={beautify}
            title="Format and indent this JSON"
          >
            Beautify
          </button>
        )}
        {beautifyError && <span className="beautify-error">Invalid JSON — can't format it</span>}
      </div>
      {body.mode === "raw" && (
        <VariableTextarea
          className="raw-body"
          value={body.raw}
          variables={variables}
          syntax={body.language === "json" ? "json" : "plain"}
          onChange={(raw) => {
            onChange({ ...body, raw });
            setBeautifyError(false);
          }}
        />
      )}
      {body.mode === "urlencoded" && (
        <KvEditor rows={body.params} variables={variables} onChange={(params) => onChange({ mode: "urlencoded", params })} />
      )}
    </div>
  );
}

export function RequestEditor({ request, variables, onChange }: RequestEditorProps) {
  const [tab, setTab] = useState<Tab>("headers");
  const [response, setResponse] = useState<ResponseState | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = (fields: Partial<SatchelRequest>) => onChange((r) => ({ ...r, ...fields }));

  const handleUrlPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!/^\s*curl\b/i.test(text)) return;
    try {
      const parsed = parseCurl(text);
      e.preventDefault();
      patch({ method: parsed.method, url: parsed.url, params: [], headers: parsed.headers, body: parsed.body, auth: parsed.auth });
    } catch {
      // Looked like curl but didn't parse — fall through to a normal paste
      // so the raw text lands in the field instead of silently vanishing.
    }
  };

  async function send() {
    setSending(true);
    setError(null);
    const started = performance.now();
    try {
      const url = buildUrl(request, variables);
      const headers = buildHeaders(request, variables);
      const hasBody = request.method !== "GET" && request.method !== "HEAD" && request.body.mode !== "none";
      const body = buildBody(request, variables);

      const doFetch = isTauri() ? tauriFetch : window.fetch;
      const res = await doFetch(url, { method: request.method, headers, body: hasBody ? body : undefined });
      const text = await res.text();
      setResponse({
        status: res.status,
        ok: res.ok,
        timeMs: Math.round(performance.now() - started),
        sizeBytes: new Blob([text]).size,
        headers: Array.from(res.headers.entries()),
        bodyText: formatBody(text, res.headers.get("content-type")),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="main">
      <div className="req-bar">
        <select className="method-select" value={request.method} onChange={(e) => patch({ method: e.target.value as HttpMethod })}>
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <VariableInput
          className="url-field"
          value={request.url}
          variables={variables}
          onChange={(url) => patch({ url })}
          onPaste={handleUrlPaste}
          placeholder="https://api.example.com/{{resource}} — or paste a curl command"
        />
        <button className="btn primary" onClick={send} disabled={sending || !request.url}>
          {sending ? "Sending…" : "Send"}
        </button>
      </div>

      <div className="tabs">
        <button className={`tab${tab === "params" ? " active" : ""}`} onClick={() => setTab("params")}>
          Params <span className="count">{request.params.length}</span>
        </button>
        <button className={`tab${tab === "headers" ? " active" : ""}`} onClick={() => setTab("headers")}>
          Headers <span className="count">{request.headers.length}</span>
        </button>
        <button className={`tab${tab === "body" ? " active" : ""}`} onClick={() => setTab("body")}>
          Body
        </button>
        <button className={`tab${tab === "auth" ? " active" : ""}`} onClick={() => setTab("auth")}>
          Auth
        </button>
      </div>

      {tab === "params" && <KvEditor rows={request.params} variables={variables} onChange={(params) => patch({ params })} />}
      {tab === "headers" && <KvEditor rows={request.headers} variables={variables} onChange={(headers) => patch({ headers })} />}
      {tab === "body" && <BodyEditor body={request.body} variables={variables} onChange={(body) => patch({ body })} />}
      {tab === "auth" && <AuthEditor auth={request.auth} variables={variables} onChange={(auth) => patch({ auth })} />}

      {(response || error) && (
        <div className="response">
          {error ? (
            <div className="resp-meta">
              <span className="status-pill err">ERROR</span>
              <span className="stat">{error}</span>
            </div>
          ) : (
            response && (
              <>
                <div className="resp-meta">
                  <span className={`status-pill ${response.ok ? "ok" : "err"}`}>{response.status}</span>
                  <span className="stat">{response.timeMs} ms</span>
                  <span className="stat">{(response.sizeBytes / 1024).toFixed(1)} KB</span>
                </div>
                <div className="json-view">{response.bodyText}</div>
              </>
            )
          )}
        </div>
      )}
    </div>
  );
}

function formatBody(text: string, contentType: string | null): string {
  if (contentType?.includes("json")) {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }
  return text;
}
