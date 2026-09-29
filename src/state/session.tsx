import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { sendRequest, type HttpResponse } from "@/http/send";
import { startBurst, type BurstConfig, type BurstResult } from "@/http/burst";
import { mergedVariables, isResolved } from "@/variables";
import { VARIABLE_PATTERN } from "@/variableTokens";
import { pathParamNames } from "@/url";
import type { SatchelRequest } from "@/types";
import { useWorkspace } from "./workspace";
import { publishResponse } from "@/features/response/popout/transport";
import { snapshotOf } from "@/features/response/popout/snapshot";
import { errorMessage } from "@/lib/errors";

/**
 * Runtime, per-window state that is NOT saved in the workspace file:
 * open tabs, which sub-tab each request shows, responses, burst runs.
 */

export const ENVIRONMENTS_TAB = "@environments";
export type TabId = string; // a request id, or ENVIRONMENTS_TAB

export type RequestTab = "params" | "headers" | "body" | "auth" | "rate";
export type ResponseTab = "body" | "headers" | "burst";

export type ResponseEntry =
  | { kind: "ok"; response: HttpResponse }
  | { kind: "error"; message: string };

export interface BurstRun {
  config: BurstConfig;
  total: number;
  running: boolean;
  results: BurstResult[]; // kept sorted by seq
  startedAt: number;
}

/** Why a send was held back, shown as an inline bar under the URL. */
export interface SendBlocker {
  requestId: string;
  /** {{variables}} that don't resolve in the active environment */
  missingVariables: string[];
}

/** Focus request for the environment matrix (e.g. "Define in Production"). */
export interface MatrixFocus {
  variable?: string;
  environmentId?: string;
  /** a just-created environment whose column should be highlighted */
  freshEnvironmentId?: string;
}

interface SessionValue {
  tabs: TabId[];
  activeTab: TabId | null;
  openTab: (id: TabId) => void;
  closeTab: (id: TabId) => void;
  setActiveTab: (id: TabId) => void;

  requestTab: (requestId: string, request?: SatchelRequest) => RequestTab;
  setRequestTab: (requestId: string, tab: RequestTab) => void;
  responseTab: (requestId: string) => ResponseTab;
  setResponseTab: (requestId: string, tab: ResponseTab) => void;

  responses: Record<string, ResponseEntry | undefined>;
  sending: Record<string, boolean | undefined>;
  /** Sends the request. Unless force, holds back and sets `blocker` when {{variables}} are unresolved. */
  send: (requestId: string, opts?: { force?: boolean }) => void;
  cancel: (requestId: string) => void;
  blocker: SendBlocker | null;
  clearBlocker: () => void;

  bursts: Record<string, BurstRun | undefined>;
  burstConfig: BurstConfig;
  setBurstConfig: (config: BurstConfig) => void;
  startBurstRun: (requestId: string) => void;
  stopBurstRun: (requestId: string) => void;

  matrixFocus: MatrixFocus | null;
  /** Open the Environments tab, optionally focusing a cell */
  openEnvironments: (focus?: MatrixFocus) => void;
  clearMatrixFocus: () => void;

  /** Bumped on every environment switch — views key a "sweep" animation off it. */
  sweepKey: number;
  bumpSweep: () => void;

  /** Ask a request's URL field to take focus (after "New request"). */
  focusUrlOf: string | null;
  requestUrlFocus: (requestId: string | null) => void;
}

const SessionContext = createContext<SessionValue | null>(null);
const TABS_KEY = "satchel.tabs";

function loadTabs(): { tabs: TabId[]; active: TabId | null } {
  try {
    const raw = JSON.parse(localStorage.getItem(TABS_KEY) ?? "null");
    if (raw && Array.isArray(raw.tabs)) return { tabs: raw.tabs, active: raw.active ?? null };
  } catch {
    // ignore
  }
  return { tabs: [], active: null };
}

export function unresolvedVariables(request: SatchelRequest, isKnown: (key: string) => boolean): string[] {
  const parts: string[] = [request.url, ...Object.values(request.pathVariables ?? {})];
  request.headers.filter((h) => h.enabled).forEach((h) => parts.push(h.value));
  const a = request.auth;
  if (a.type === "bearer") parts.push(a.token);
  if (a.type === "basic") parts.push(a.username, a.password);
  if (a.type === "apikey") parts.push(a.value);
  const b = request.body;
  if (b.mode === "raw") parts.push(b.raw);
  if (b.mode === "urlencoded") b.params.filter((p) => p.enabled).forEach((p) => parts.push(p.value));
  if (b.mode === "formdata") b.fields.filter((f) => f.enabled && f.type === "text").forEach((f) => parts.push(f.value));
  const keys = new Set<string>();
  for (const part of parts) for (const m of part.matchAll(VARIABLE_PATTERN)) keys.add(m[1]);
  return [...keys].filter((k) => !isKnown(k));
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const ws = useWorkspace();
  const initial = useRef(loadTabs());
  const [tabs, setTabs] = useState<TabId[]>(initial.current.tabs);
  const [activeTab, setActiveTabState] = useState<TabId | null>(initial.current.active);
  const [requestTabs, setRequestTabs] = useState<Record<string, RequestTab>>({});
  const [responseTabs, setResponseTabs] = useState<Record<string, ResponseTab>>({});
  const [responses, setResponses] = useState<Record<string, ResponseEntry | undefined>>({});
  const [sending, setSending] = useState<Record<string, boolean | undefined>>({});
  const [blocker, setBlocker] = useState<SendBlocker | null>(null);
  const [bursts, setBursts] = useState<Record<string, BurstRun | undefined>>({});
  const [burstConfig, setBurstConfig] = useState<BurstConfig>({ rps: 20, seconds: 5, stopAtFirst429: false });
  const [matrixFocus, setMatrixFocus] = useState<MatrixFocus | null>(null);
  const [sweepKey, setSweepKey] = useState(0);
  const [focusUrlOf, setFocusUrlOf] = useState<string | null>(null);
  const aborts = useRef<Record<string, AbortController>>({});
  const burstStops = useRef<Record<string, () => void>>({});

  // Drop tabs whose request no longer exists (deleted, or a different file was opened).
  useEffect(() => {
    setTabs((t) => {
      const next = t.filter((id) => id === ENVIRONMENTS_TAB || ws.findRequest(id));
      return next.length === t.length ? t : next;
    });
  }, [ws.findRequest]);
  useEffect(() => {
    if (activeTab && !tabs.includes(activeTab)) setActiveTabState(tabs[tabs.length - 1] ?? null);
  }, [tabs, activeTab]);
  useEffect(() => {
    try {
      localStorage.setItem(TABS_KEY, JSON.stringify({ tabs, active: activeTab }));
    } catch {
      // ignore
    }
  }, [tabs, activeTab]);

  const openTab = useCallback((id: TabId) => {
    setTabs((t) => (t.includes(id) ? t : [...t, id]));
    setActiveTabState(id);
    setBlocker(null);
  }, []);

  const closeTab = useCallback(
    (id: TabId) => {
      setTabs((t) => {
        const i = t.indexOf(id);
        const next = t.filter((x) => x !== id);
        if (id === activeTab) setActiveTabState(next[Math.min(i, next.length - 1)] ?? null);
        return next;
      });
    },
    [activeTab],
  );

  const send = useCallback(
    (requestId: string, opts?: { force?: boolean }) => {
      const loc = ws.findRequest(requestId);
      if (!loc) return;
      const ctx = ws.variableContext(requestId);
      const missing = unresolvedVariables(loc.request, (k) => isResolved(k, ctx));
      if (missing.length && !opts?.force) {
        setBlocker({ requestId, missingVariables: missing });
        return;
      }
      const emptyPath = pathParamNames(loc.request.url).filter((n) => !loc.request.pathVariables?.[n]);
      if (emptyPath.length && !opts?.force) {
        setRequestTabs((m) => ({ ...m, [requestId]: "params" }));
        setResponses((r) => ({ ...r, [requestId]: { kind: "error", message: `Path parameter :${emptyPath[0]} needs a value.` } }));
        return;
      }
      setBlocker(null);
      aborts.current[requestId]?.abort();
      const controller = new AbortController();
      aborts.current[requestId] = controller;
      setSending((s) => ({ ...s, [requestId]: true }));
      setResponseTabs((m) => (m[requestId] === "burst" ? { ...m, [requestId]: "body" } : m));
      sendRequest(loc.request, mergedVariables(ctx), controller.signal)
        .then((response) => {
          setResponses((r) => ({ ...r, [requestId]: { kind: "ok", response } }));
          publishResponse(snapshotOf(loc.request, response));
        })
        .catch((err) => {
          if (controller.signal.aborted) return;
          const message = errorMessage(err, "Request failed");
          setResponses((r) => ({ ...r, [requestId]: { kind: "error", message } }));
        })
        .finally(() => {
          if (aborts.current[requestId] === controller) {
            delete aborts.current[requestId];
            setSending((s) => ({ ...s, [requestId]: false }));
          }
        });
    },
    [ws],
  );

  const cancel = useCallback((requestId: string) => {
    aborts.current[requestId]?.abort();
    delete aborts.current[requestId];
    setSending((s) => ({ ...s, [requestId]: false }));
  }, []);

  const startBurstRun = useCallback(
    (requestId: string) => {
      const loc = ws.findRequest(requestId);
      if (!loc) return;
      burstStops.current[requestId]?.();
      const config = burstConfig;
      const total = Math.min(Math.max(config.rps, 1), 200) * Math.min(Math.max(config.seconds, 1), 60);
      setBursts((b) => ({ ...b, [requestId]: { config, total, running: true, results: [], startedAt: Date.now() } }));
      setResponseTabs((m) => ({ ...m, [requestId]: "burst" }));
      burstStops.current[requestId] = startBurst(
        loc.request,
        mergedVariables(ws.variableContext(requestId)),
        config,
        (result) =>
          setBursts((b) => {
            const run = b[requestId];
            if (!run) return b;
            const results = [...run.results, result].sort((x, y) => x.seq - y.seq);
            return { ...b, [requestId]: { ...run, results } };
          }),
        () => setBursts((b) => (b[requestId] ? { ...b, [requestId]: { ...b[requestId]!, running: false } } : b)),
      );
    },
    [ws, burstConfig],
  );

  const stopBurstRun = useCallback((requestId: string) => {
    burstStops.current[requestId]?.();
    delete burstStops.current[requestId];
  }, []);

  const value: SessionValue = {
    tabs,
    activeTab,
    openTab,
    closeTab,
    setActiveTab: (id) => {
      setActiveTabState(id);
      setBlocker(null);
    },
    requestTab: (requestId, request) =>
      requestTabs[requestId] ?? (request && request.body.mode !== "none" ? "body" : "params"),
    setRequestTab: (requestId, tab) => setRequestTabs((m) => ({ ...m, [requestId]: tab })),
    responseTab: (requestId) => {
      const t = responseTabs[requestId] ?? "body";
      return t === "burst" && !bursts[requestId] ? "body" : t;
    },
    setResponseTab: (requestId, tab) => setResponseTabs((m) => ({ ...m, [requestId]: tab })),
    responses,
    sending,
    send,
    cancel,
    blocker,
    clearBlocker: () => setBlocker(null),
    bursts,
    burstConfig,
    setBurstConfig,
    startBurstRun,
    stopBurstRun,
    matrixFocus,
    openEnvironments: (focus) => {
      setMatrixFocus(focus ?? null);
      openTab(ENVIRONMENTS_TAB);
    },
    clearMatrixFocus: () => setMatrixFocus(null),
    sweepKey,
    bumpSweep: () => setSweepKey((k) => k + 1),
    focusUrlOf,
    requestUrlFocus: setFocusUrlOf,
  };

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
