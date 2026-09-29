import { memo, useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { JSON_TOKEN_CLASS, tokenizeJsonLike, type JsonRun } from "@/jsonTokens";
import { buildPieces } from "./viewer/highlight";
import type { Range } from "./viewer/jsonSearch";

/** Past this, skip per-token coloring — a multi-MB body would mount hundreds of thousands of spans. */
const HIGHLIGHT_LIMIT = 300_000;

const NO_RANGES: Range[] = [];

interface JsonViewerProps {
  text: string;
  /** color JSON tokens; plain text otherwise */
  json: boolean;
  /** search matches to mark, sorted and non-overlapping */
  ranges?: Range[];
  /** index into `ranges` of the current match; scrolled into view */
  activeMatch?: number;
  /** "raw": no gutter, wraps long lines */
  layout?: "pretty" | "raw";
}

/** Read-only code view with a line-number gutter (pretty) or wrapped plain text (raw). */
export const JsonViewer = memo(function JsonViewer({ text, json, ranges = NO_RANGES, activeMatch = -1, layout = "pretty" }: JsonViewerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const raw = layout === "raw";

  const lineNumbers = useMemo(() => {
    if (raw) return "";
    let n = 1;
    for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++;
    return Array.from({ length: n }, (_, i) => i + 1).join("\n");
  }, [text, raw]);

  const runs = useMemo<JsonRun[]>(
    () => (json && text.length <= HIGHLIGHT_LIMIT ? tokenizeJsonLike(text) : [{ text, kind: "text" }]),
    [text, json],
  );

  const content = useMemo<ReactNode>(() => {
    if (runs.length === 1 && !ranges.length) return text;
    return buildPieces(runs, ranges).map((p, i) => {
      const cls = JSON_TOKEN_CLASS[p.kind];
      const inner = cls ? <span className={cls}>{p.text}</span> : p.text;
      return p.match < 0 ? (
        cls ? (
          <span key={i} className={cls}>
            {p.text}
          </span>
        ) : (
          p.text
        )
      ) : (
        <mark
          key={i}
          data-m={p.match}
          className="rounded-[2px] bg-brass-soft text-inherit data-active:bg-brass data-active:text-brass-ink [&[data-active]>span]:text-brass-ink"
        >
          {inner}
        </mark>
      );
    });
  }, [runs, ranges, text]);

  // The active mark is toggled on the DOM directly, so stepping through matches
  // doesn't re-render a document's worth of spans.
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll("mark[data-active]").forEach((el) => el.removeAttribute("data-active"));
    if (activeMatch < 0) return;
    const marks = root.querySelectorAll(`mark[data-m="${activeMatch}"]`);
    marks.forEach((el) => el.setAttribute("data-active", ""));
    marks[0]?.scrollIntoView({ block: "center", inline: "nearest" });
  }, [activeMatch, content]);

  if (raw) {
    return (
      <div ref={ref} className="px-3 pt-2 pb-6 font-mono text-[12.5px] leading-5 break-all whitespace-pre-wrap select-text">
        {content}
      </div>
    );
  }
  return (
    <div ref={ref} className="grid grid-cols-[auto_1fr] pt-2 pb-6 font-mono text-[12.5px] leading-5">
      <div aria-hidden className="pr-2.5 pl-3 text-right whitespace-pre text-fg3 opacity-60 select-none">
        {lineNumbers}
      </div>
      <div className="min-w-0 pr-4 whitespace-pre select-text">{content}</div>
    </div>
  );
});
