import { useRef, useState } from "react";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import type { KeyValue, SatchelRequest } from "../types";
import { isTauri } from "../platform";
import { buildBody, buildHeaders, buildUrl } from "../requestBuilder";

interface RateLimitTesterProps {
  request: SatchelRequest;
  variables: KeyValue[];
}

interface RunResult {
  seq: number;
  offsetMs: number;
  status: number | null;
  ok: boolean;
  timeMs: number;
  rateLimitHeaders: [string, string][];
  error?: string;
}

// Any header naming a rate-limit scheme varies by API (X-RateLimit-*,
// RateLimit-*, Retry-After, ...) — match loosely instead of a fixed allowlist.
const RATE_HEADER_RE = /rate.?limit|retry-after/i;

export function RateLimitTester({ request, variables }: RateLimitTesterProps) {
  const [rate, setRate] = useState(5);
  const [durationSec, setDurationSec] = useState(10);
  const [running, setRunning] = useState(false);
  const [sentCount, setSentCount] = useState(0);
  const [results, setResults] = useState<RunResult[]>([]);

  // Scheduling lives in refs, not state — the recursive setTimeout loop reads
  // these synchronously between ticks, and a state read there could be stale.
  const runningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function stop() {
    runningRef.current = false;
    abortRef.current?.abort();
    if (timerRef.current) clearTimeout(timerRef.current);
    setRunning(false);
  }

  function start() {
    if (!request.url || running) return;
    const safeRate = Math.min(Math.max(rate, 1), 100);
    const safeDuration = Math.min(Math.max(durationSec, 1), 300);

    const controller = new AbortController();
    abortRef.current = controller;
    runningRef.current = true;
    setRunning(true);
    setResults([]);
    setSentCount(0);

    const startTime = performance.now();
    const intervalMs = 1000 / safeRate;
    let sent = 0;

    const fireOne = async (seq: number) => {
      const sentAt = performance.now();
      const record = (result: RunResult) => {
        if (!runningRef.current) return;
        setResults((prev) => [...prev, result]);
      };
      try {
        const url = buildUrl(request, variables);
        const headers = buildHeaders(request, variables);
        const hasBody = request.method !== "GET" && request.method !== "HEAD" && request.body.mode !== "none";
        const body = buildBody(request, variables);
        const doFetch = isTauri() ? tauriFetch : window.fetch;
        const res = await doFetch(url, {
          method: request.method,
          headers,
          body: hasBody ? body : undefined,
          signal: controller.signal,
        });
        // Only status/headers/timing matter here — cancel the body instead
        // of reading it, so the run doesn't slow down draining large responses.
        try {
          res.body?.cancel?.().catch(() => {});
        } catch {
          // Some environments don't support stream cancellation — harmless to skip.
        }
        record({
          seq,
          offsetMs: Math.round(sentAt - startTime),
          status: res.status,
          ok: res.ok,
          timeMs: Math.round(performance.now() - sentAt),
          rateLimitHeaders: Array.from(res.headers.entries()).filter(([k]) => RATE_HEADER_RE.test(k)),
        });
      } catch (err) {
        if (controller.signal.aborted) return; // cancelled by Stop — not a result
        record({
          seq,
          offsetMs: Math.round(sentAt - startTime),
          status: null,
          ok: false,
          timeMs: Math.round(performance.now() - sentAt),
          rateLimitHeaders: [],
          error: err instanceof Error ? err.message : "Request failed",
        });
      }
    };

    // A background/unfocused tab gets its setTimeout chain throttled by the
    // browser (Chrome clamps to ~1 tick/sec), which would otherwise silently
    // degrade the run to 1 req/sec regardless of the configured rate. Instead
    // of firing exactly once per tick, fire every request that's come due
    // since the last tick fired — so a delayed tick catches up in a burst
    // rather than losing throughput for the rest of the run.
    const tick = () => {
      if (!runningRef.current) return;
      const elapsed = performance.now() - startTime;
      if (elapsed >= safeDuration * 1000) {
        runningRef.current = false;
        setRunning(false);
        return;
      }
      const due = Math.floor(elapsed / intervalMs) + 1;
      while (sent < due) {
        sent += 1;
        fireOne(sent);
      }
      setSentCount(sent);
      timerRef.current = setTimeout(tick, intervalMs);
    };
    tick();
  }

  const sorted = [...results].sort((a, b) => a.seq - b.seq);
  const completed = sorted.length;
  const okCount = sorted.filter((r) => r.ok).length;
  const limitedCount = sorted.filter((r) => r.status === 429).length;
  const errorCount = completed - okCount - limitedCount;
  const firstLimited = sorted.find((r) => r.status === 429);

  return (
    <div className="panel rl-panel">
      <div className="rl-config">
        <label className="rl-field">
          <span className="field-label">Requests / sec</span>
          <input
            type="number"
            min={1}
            max={100}
            value={rate}
            disabled={running}
            onChange={(e) => setRate(Number(e.target.value) || 1)}
          />
        </label>
        <label className="rl-field">
          <span className="field-label">Duration (sec)</span>
          <input
            type="number"
            min={1}
            max={300}
            value={durationSec}
            disabled={running}
            onChange={(e) => setDurationSec(Number(e.target.value) || 1)}
          />
        </label>
        {running ? (
          <button className="btn" onClick={stop}>
            Stop
          </button>
        ) : (
          <button className="btn primary" onClick={start} disabled={!request.url}>
            Start Run
          </button>
        )}
      </div>

      {(running || completed > 0) && (
        <>
          <div className="rl-summary">
            <span className="stat">{running ? "Sending…" : "Done"}</span>
            <span className="stat">{sentCount} sent</span>
            <span className="stat">{completed} completed</span>
            <span className="stat ok">{okCount} ok</span>
            <span className={`stat${limitedCount > 0 ? " limited" : ""}`}>{limitedCount} rate-limited (429)</span>
            {errorCount > 0 && <span className="stat err">{errorCount} error{errorCount === 1 ? "" : "s"}</span>}
            {firstLimited && <span className="stat limited">first 429 at t+{firstLimited.offsetMs}ms</span>}
          </div>

          <div className="rl-log">
            <div className="rl-row rl-row-head">
              <span>#</span>
              <span>t+ms</span>
              <span>status</span>
              <span>ms</span>
              <span>rate-limit headers</span>
            </div>
            {sorted.map((r) => (
              <div className={`rl-row${r.status === 429 ? " limited" : r.ok ? "" : " err"}`} key={r.seq}>
                <span>{r.seq}</span>
                <span>{r.offsetMs}</span>
                <span className={`status-pill ${r.status === 429 ? "limited" : r.ok ? "ok" : "err"}`}>
                  {r.status ?? "ERR"}
                </span>
                <span>{r.timeMs}</span>
                <span className="rl-headers">
                  {r.error
                    ? r.error
                    : r.rateLimitHeaders.length > 0
                      ? r.rateLimitHeaders.map(([k, v]) => `${k}: ${v}`).join("  ")
                      : "—"}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
