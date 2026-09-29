import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { BurstResult } from "@/http/burst";
import { chartGeometry, type ResultKind } from "./burstMath";

const BAR_FILL: Record<ResultKind, { fill: string; opacity: number }> = {
  ok: { fill: "var(--ok)", opacity: 0.75 },
  limited: { fill: "var(--err)", opacity: 0.85 },
  other: { fill: "var(--warn)", opacity: 0.8 },
  error: { fill: "var(--fg3)", opacity: 0.7 },
};

interface BurstChartProps {
  results: BurstResult[];
  seconds: number;
  total: number;
}

/** Container width, tracked with a ResizeObserver (the split gutter resizes the pane). */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Latency per request over time, with X-RateLimit-Remaining and the first 429. */
export function BurstChart({ results, seconds, total }: BurstChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  // clientWidth includes the 4px right padding
  const g = useMemo(() => chartGeometry(results, seconds, total, width - 4), [results, seconds, total, width]);
  const hasErrors = g.bars.some((b) => b.kind === "error");

  return (
    <div ref={ref} className="pt-2 pr-1">
      <svg
        width={g.width}
        height={g.height}
        viewBox={`0 0 ${g.width} ${g.height}`}
        role="img"
        aria-label="Latency per request over time"
        className="block [&_text]:fill-fg3 [&_text]:font-mono [&_text]:text-[10px]"
      >
        {g.ticks.map((t) => (
          <g key={t.label}>
            <line x1={g.left} x2={g.right} y1={t.y} y2={t.y} stroke="var(--line)" />
            <text x={g.left - 6} y={t.y + 3} textAnchor="end">
              {t.label}
            </text>
          </g>
        ))}
        <text x={g.left} y={g.height - 6}>
          0s
        </text>
        <text x={g.right} y={g.height - 6} textAnchor="end">
          {seconds}s
        </text>
        {g.remaining && (
          <>
            <text x={g.right + 6} y={g.top + 3}>
              {g.remaining.scale}
            </text>
            <text x={g.right + 6} y={g.bottom + 3}>
              0
            </text>
          </>
        )}
        {g.bars.map((b) => (
          <rect key={b.seq} x={b.x} y={b.y} width={b.w} height={b.h} rx={0.5} fill={BAR_FILL[b.kind].fill} opacity={BAR_FILL[b.kind].opacity} />
        ))}
        {g.remaining && (
          <path d={g.remaining.path} fill="none" stroke="var(--fg2)" strokeWidth={1.2} strokeDasharray="3 3" />
        )}
        {g.first429 && (
          <>
            <line x1={g.first429.x} x2={g.first429.x} y1={g.top} y2={g.bottom} stroke="var(--err)" strokeWidth={1} />
            <text
              x={g.first429.x + (g.first429.anchor === "start" ? 5 : -5)}
              y={g.top + 9}
              textAnchor={g.first429.anchor}
              style={{ fill: "var(--err)" }}
            >
              first 429 · #{g.first429.seq}
            </text>
          </>
        )}
      </svg>
      <div className="flex flex-wrap gap-x-3.5 pt-0.5 pb-2 text-[11px] text-fg3" style={{ paddingLeft: g.left }}>
        <LegendSwatch color="var(--ok)">2xx latency</LegendSwatch>
        <LegendSwatch color="var(--err)">429</LegendSwatch>
        {hasErrors && <LegendSwatch color="var(--fg3)">Error</LegendSwatch>}
        {g.remaining && (
          <span>
            <i className="mr-[5px] inline-block w-3 border-t-[1.2px] border-dashed border-fg2 align-middle" />
            X-RateLimit-Remaining
          </span>
        )}
      </div>
    </div>
  );
}

function LegendSwatch({ color, children }: { color: string; children: string }) {
  return (
    <span>
      <i className="mr-[5px] inline-block size-2 rounded-[2px]" style={{ background: color }} />
      {children}
    </span>
  );
}
