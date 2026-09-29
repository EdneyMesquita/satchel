import type { BurstResult } from "@/http/burst";

/**
 * Pure math behind the Burst panel: summary stats and the chart geometry.
 * Kept free of React/DOM so it can be unit-tested.
 */

export type ResultKind = "ok" | "limited" | "other" | "error";

export function resultKind(r: BurstResult): ResultKind {
  if (r.status === null) return "error";
  if (r.status === 429) return "limited";
  if (r.status >= 200 && r.status < 300) return "ok";
  return "other";
}

/** Nearest-rank percentile of an ascending-sorted list; null when empty. */
export function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

/** The first 429 by sequence number (results need not be sorted). */
export function firstRateLimited(results: BurstResult[]): BurstResult | null {
  let first: BurstResult | null = null;
  for (const r of results) if (r.status === 429 && (!first || r.seq < first.seq)) first = r;
  return first;
}

export interface BurstSummary {
  sent: number;
  ok: number;
  limited: number;
  /** non-2xx, non-429 HTTP statuses */
  other: number;
  /** network failures (no status) */
  errors: number;
  p50: number | null;
  p95: number | null;
  first429: BurstResult | null;
}

export function summarizeBurst(results: BurstResult[]): BurstSummary {
  const counts = { ok: 0, limited: 0, other: 0, error: 0 };
  const latencies: number[] = [];
  for (const r of results) {
    const k = resultKind(r);
    counts[k]++;
    if (k === "ok") latencies.push(r.ms);
  }
  latencies.sort((a, b) => a - b);
  return {
    sent: results.length,
    ok: counts.ok,
    limited: counts.limited,
    other: counts.other,
    errors: counts.error,
    p50: percentile(latencies, 0.5),
    p95: percentile(latencies, 0.95),
    first429: firstRateLimited(results),
  };
}

/**
 * Scale for the X-RateLimit-Remaining line: the largest limit the server
 * reported, else (first remaining + 1), never below the largest remaining
 * seen. Null when the server sent no remaining header at all.
 */
export function remainingScale(results: BurstResult[]): number | null {
  let maxLimit = 0;
  let maxRemaining = -1;
  let firstRemaining: number | null = null;
  for (const r of results) {
    if (r.limit !== null && r.limit > maxLimit) maxLimit = r.limit;
    if (r.remaining !== null) {
      if (firstRemaining === null) firstRemaining = r.remaining;
      if (r.remaining > maxRemaining) maxRemaining = r.remaining;
    }
  }
  if (firstRemaining === null) return null;
  const scale = maxLimit > 0 ? maxLimit : firstRemaining + 1;
  return Math.max(scale, maxRemaining, 1);
}

/** Latency axis top: at least 120 ms, rounded up to the next 50. */
export function latencyTop(results: BurstResult[]): number {
  let max = 120;
  for (const r of results) if (r.ms > max) max = r.ms;
  return Math.ceil(max / 50) * 50;
}

export const CHART = { height: 150, left: 50, right: 34, top: 12, bottom: 22, minWidth: 280 } as const;

export interface ChartBar {
  seq: number;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: ResultKind;
}

export interface ChartTick {
  y: number;
  label: string;
}

export interface ChartGeometry {
  width: number;
  height: number;
  /** plot area */
  left: number;
  right: number;
  top: number;
  bottom: number;
  ticks: ChartTick[];
  bars: ChartBar[];
  /** dashed step line of X-RateLimit-Remaining, with the scale it was drawn against */
  remaining: { path: string; scale: number } | null;
  first429: { x: number; seq: number; anchor: "start" | "end" } | null;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function chartGeometry(results: BurstResult[], seconds: number, total: number, containerWidth: number): ChartGeometry {
  const width = Math.max(CHART.minWidth, Math.floor(containerWidth));
  const height = CHART.height;
  const left = CHART.left;
  const right = width - CHART.right;
  const top = CHART.top;
  const bottom = height - CHART.bottom;
  const pw = right - left;
  const ph = bottom - top;
  const span = Math.max(seconds, 0.001);
  const topMs = latencyTop(results);

  const x = (t: number) => left + (Math.min(Math.max(t, 0), span) / span) * pw;
  const y = (ms: number) => bottom - (Math.min(Math.max(ms, 0), topMs) / topMs) * ph;
  // Capped so a short run (few requests) draws slim bars that stay inside the plot.
  const bw = Math.min(10, Math.max(1.2, (pw / Math.max(total, 1)) * 0.62));

  const ticks: ChartTick[] = [0, 0.5, 1].map((f) => ({
    y: bottom - f * ph,
    label: `${Math.round(topMs * f)}${f === 1 ? " ms" : ""}`,
  }));

  const bars: ChartBar[] = results.map((r) => {
    const by = y(r.ms);
    return { seq: r.seq, x: round(x(r.t) - bw / 2), y: round(by), w: round(bw), h: round(bottom - by), kind: resultKind(r) };
  });

  let remaining: ChartGeometry["remaining"] = null;
  const scale = remainingScale(results);
  if (scale !== null) {
    const ry = (rem: number) => bottom - (Math.min(Math.max(rem, 0), scale) / scale) * ph;
    let d = `M${round(x(0))},${round(ry(scale))}`;
    for (const r of results) if (r.remaining !== null) d += ` H${round(x(r.t))} V${round(ry(r.remaining))}`;
    remaining = { path: d, scale };
  }

  const first = firstRateLimited(results);
  const first429 = first
    ? { x: round(x(first.t)), seq: first.seq, anchor: (x(first.t) > right - 90 ? "end" : "start") as "start" | "end" }
    : null;

  return { width, height, left, right, top, bottom, ticks, bars, remaining, first429 };
}
