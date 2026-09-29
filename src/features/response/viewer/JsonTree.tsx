import {
  memo,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyWithToast, valueToClipboard } from "./copy";
import { displayPath, valueAt, type JsonPath } from "./jsonPath";
import type { TreeSearchResult } from "./jsonSearch";
import { Marked } from "./Marked";
import {
  CHUNK,
  allContainerIds,
  defaultExpanded,
  flattenRows,
  isContainer,
  parentIdOf,
  reveal,
  summarize,
  type Container,
  type MoreRow,
  type NodeRow,
  type TreeRow,
} from "./treeModel";

const ROW = 22;
const INDENT = 16;
const PAD_X = 8;
const PAD_TOP = 4;
const OVERSCAN = 12;
/** With this many matches or fewer, every match's ancestors open, not just the active one's. */
const REVEAL_ALL_LIMIT = 200;
/** Long strings are cut in the row; the full value is one "Copy value" away. */
const MAX_VALUE_CHARS = 400;

export interface JsonTreeHandle {
  expandAll: () => void;
  collapseAll: () => void;
  focus: () => void;
}

interface JsonTreeProps {
  root: unknown;
  /** matches for the current query, or null without one */
  search: TreeSearchResult | null;
  /** the (trimmed) query, for marking matched text */
  query: string;
  activeMatch: number;
  /** selection changes (row click, keyboard, stepping through matches) */
  onSelect?: (path: JsonPath | null) => void;
  ref?: Ref<JsonTreeHandle>;
}

interface TreeView {
  expanded: Set<string>;
  limits: Map<string, number>;
}

interface Selection {
  id: string;
  path: JsonPath;
}

/** Collapsible, virtualized JSON tree. Remount (key) it for a new document. */
export function JsonTree({ root, search, query, activeMatch, onSelect, ref }: JsonTreeProps) {
  const [view, setView] = useState<TreeView>(() => ({ expanded: defaultExpanded(root), limits: new Map() }));
  const [selected, setSelected] = useState<Selection | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(0);
  const pendingScroll = useRef<{ id: string; block: "center" | "nearest" } | null>(null);
  const revealedFor = useRef<TreeSearchResult | null>(null);

  const rows = useMemo(() => flattenRows(root, view.expanded, view.limits), [root, view]);
  const matchIds = useMemo(() => new Set(search?.matches.map((m) => m.id)), [search]);
  const activeId = search?.matches[activeMatch]?.id ?? null;

  useImperativeHandle(
    ref,
    () => ({
      expandAll: () => setView((v) => ({ expanded: allContainerIds(root), limits: v.limits })),
      collapseAll: () => setView((v) => ({ expanded: new Set([""]), limits: v.limits })),
      focus: () => scrollRef.current?.focus(),
    }),
    [root],
  );

  // Open the way to the matches: all of them when there are few, always the active one.
  useEffect(() => {
    if (!search || !search.matches.length) return;
    const active = search.matches[activeMatch];
    setView((v) => {
      const expanded = new Set(v.expanded);
      const limits = new Map(v.limits);
      if (revealedFor.current !== search && search.matches.length <= REVEAL_ALL_LIMIT) {
        for (const m of search.matches) reveal(root, m.path, expanded, limits);
      }
      if (active) {
        reveal(root, active.path, expanded, limits);
        if (search.byPath && active.path.length && isContainer(valueAt(root, active.path))) expanded.add(active.id);
      }
      return { expanded, limits };
    });
    revealedFor.current = search;
    if (active) {
      setSelected({ id: active.id, path: active.path });
      pendingScroll.current = { id: active.id, block: "center" };
    }
  }, [root, search, activeMatch]);

  useEffect(() => {
    onSelect?.(selected?.path ?? null);
  }, [selected, onSelect]);

  // Track the viewport for virtualization.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setViewport(el.clientHeight));
    ro.observe(el);
    setViewport(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  // Scroll a row into view once it exists (after a reveal or a keyboard move).
  useLayoutEffect(() => {
    const target = pendingScroll.current;
    const el = scrollRef.current;
    if (!target || !el) return;
    const index = rows.findIndex((r) => r.id === target.id);
    if (index < 0) return;
    pendingScroll.current = null;
    const top = PAD_TOP + index * ROW;
    const height = el.clientHeight;
    if (target.block === "center") {
      if (top < el.scrollTop || top + ROW > el.scrollTop + height) el.scrollTop = Math.max(0, top - height / 2 + ROW / 2);
    } else if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW > el.scrollTop + height) el.scrollTop = top + ROW - height;
  });

  const toggle = useCallback((id: string) => {
    setView((v) => {
      const expanded = new Set(v.expanded);
      if (!expanded.delete(id)) expanded.add(id);
      return { expanded, limits: v.limits };
    });
  }, []);

  const showMore = useCallback((parentId: string) => {
    setView((v) => {
      const limits = new Map(v.limits);
      limits.set(parentId, (limits.get(parentId) ?? CHUNK) + CHUNK);
      return { expanded: v.expanded, limits };
    });
  }, []);

  const select = useCallback((row: NodeRow) => setSelected({ id: row.id, path: row.path }), []);

  const moveTo = (row: TreeRow | undefined) => {
    if (!row || row.kind !== "node") return;
    setSelected({ id: row.id, path: row.path });
    pendingScroll.current = { id: row.id, block: "nearest" };
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.altKey || e.metaKey || e.ctrlKey) return;
    const index = selected ? rows.findIndex((r) => r.id === selected.id) : -1;
    const row = rows[index];
    const step = (from: number, dir: 1 | -1) => {
      for (let i = from + dir; i >= 0 && i < rows.length; i += dir) if (rows[i].kind === "node") return rows[i];
      return undefined;
    };
    switch (e.key) {
      case "ArrowDown":
        moveTo(index < 0 ? rows[0] : step(index, 1));
        break;
      case "ArrowUp":
        moveTo(index < 0 ? rows[0] : step(index, -1));
        break;
      case "Home":
        moveTo(rows[0]);
        break;
      case "End":
        moveTo(step(rows.length, -1));
        break;
      case "ArrowRight":
        if (row?.kind !== "node" || !row.container || !row.size) return;
        if (!row.expanded) toggle(row.id);
        else moveTo(rows[index + 1]);
        break;
      case "ArrowLeft":
        if (row?.kind !== "node") return;
        if (row.expanded) toggle(row.id);
        else {
          const parent = parentIdOf(rows, index);
          if (parent !== null) moveTo(rows.find((r) => r.id === parent));
        }
        break;
      case "Enter":
      case " ":
        if (row?.kind === "node" && row.container && row.size) toggle(row.id);
        else return;
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const start = Math.max(0, Math.floor((scrollTop - PAD_TOP) / ROW) - OVERSCAN);
  const end = Math.min(rows.length, Math.ceil((scrollTop + (viewport || 800)) / ROW) + OVERSCAN);
  const needle = search && !search.byPath ? query : "";

  if (!rows.length) {
    return (
      <div className="px-3 py-3.5 font-mono text-[12.5px] text-fg3">
        {Array.isArray(root) ? "[] empty array" : "{} empty object"}
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      role="tree"
      aria-label="Response body"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
      className="h-full min-h-0 overflow-auto outline-none"
    >
      <div className="relative" style={{ height: PAD_TOP * 2 + rows.length * ROW + 16 }}>
        <div className="absolute inset-x-0" style={{ top: PAD_TOP + start * ROW }}>
          {rows.slice(start, end).map((row) =>
            row.kind === "more" ? (
              <MoreRowView key={row.id} row={row} onMore={showMore} />
            ) : (
              <NodeRowView
                key={row.id}
                row={row}
                selected={selected?.id === row.id}
                match={matchIds.has(row.id)}
                active={activeId === row.id}
                needle={needle}
                onToggle={toggle}
                onSelect={select}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function Guides({ depth }: { depth: number }) {
  if (!depth) return null;
  return (
    <>
      {Array.from({ length: depth }, (_, d) => (
        <span key={d} aria-hidden className="absolute inset-y-0 w-px bg-line" style={{ left: PAD_X + d * INDENT + INDENT / 2 }} />
      ))}
    </>
  );
}

interface NodeRowViewProps {
  row: NodeRow;
  selected: boolean;
  match: boolean;
  active: boolean;
  /** text to mark in the key/value; "" for none */
  needle: string;
  onToggle: (id: string) => void;
  onSelect: (row: NodeRow) => void;
}

const NodeRowView = memo(function NodeRowView({ row, selected, match, active, needle, onToggle, onSelect }: NodeRowViewProps) {
  const openable = row.container && row.size > 0;
  const markNeedle = match ? needle : "";
  return (
    <div
      role="treeitem"
      aria-level={row.depth + 1}
      aria-expanded={openable ? row.expanded : undefined}
      aria-selected={selected}
      onClick={() => {
        onSelect(row);
        if (openable) onToggle(row.id);
      }}
      className={cn(
        "group relative flex cursor-default items-center pr-2 font-mono text-[12.5px] whitespace-pre",
        selected ? "bg-bg3" : "hover:bg-bg2",
        active && "before:absolute before:inset-y-[3px] before:left-0 before:w-[2px] before:rounded-full before:bg-brass",
      )}
      style={{ height: ROW, paddingLeft: PAD_X + row.depth * INDENT }}
    >
      <Guides depth={row.depth} />
      <span className="grid w-4 flex-none place-items-center text-fg3">
        {openable && <ChevronRight className={cn("size-3 transition-transform duration-100", row.expanded && "rotate-90")} aria-hidden />}
      </span>
      {row.segment !== null && (
        <>
          {typeof row.segment === "number" ? (
            <span className="flex-none text-fg3">{row.segment}</span>
          ) : (
            <span className="min-w-0 flex-none truncate text-j-k" style={{ maxWidth: "60%" }}>
              <Marked text={row.segment} needle={markNeedle} active={active} />
            </span>
          )}
          <span className="flex-none text-j-p">: </span>
        </>
      )}
      <span className="min-w-0 truncate">
        <ValueText row={row} needle={markNeedle} active={active} />
      </span>
      <RowActions row={row} />
    </div>
  );
});

function ValueText({ row, needle, active }: { row: NodeRow; needle: string; active: boolean }) {
  const v = row.value;
  if (row.container) {
    const arr = Array.isArray(v);
    if (!row.size) return <span className="text-j-p">{arr ? "[]" : "{}"}</span>;
    const summary = summarize(v as Container, row.size);
    if (row.expanded) return <span className="text-fg3 opacity-70">{summary}</span>;
    return (
      <>
        <span className="text-j-p">{arr ? "[…]" : "{…}"}</span>
        <span className="text-fg3"> {summary}</span>
      </>
    );
  }
  if (typeof v === "string") {
    const json = JSON.stringify(v);
    const inner = json.length - 2 > MAX_VALUE_CHARS ? `${json.slice(1, MAX_VALUE_CHARS + 1)}…` : json.slice(1, -1);
    return (
      <span className="json-string">
        "<Marked text={inner} needle={needle} active={active} />"
      </span>
    );
  }
  const text = v === null ? "null" : String(v);
  return (
    <span className={typeof v === "number" ? "json-number" : "json-literal"}>
      <Marked text={text} needle={needle} active={active} />
    </span>
  );
}

/** "Copy path" / "Copy value", shown on hover at the row's end. */
function RowActions({ row }: { row: NodeRow }) {
  const btn = "h-[18px] rounded-sm px-1.5 font-sans text-[11px] text-fg3 hover:bg-bg3 hover:text-fg";
  return (
    <span className="absolute inset-y-0 right-1 hidden items-center gap-0.5 bg-inherit pl-2 group-hover:flex">
      <button
        type="button"
        className={btn}
        title={displayPath(row.path)}
        onClick={(e) => {
          e.stopPropagation();
          void copyWithToast(displayPath(row.path), "Path copied.");
        }}
      >
        Copy path
      </button>
      <button
        type="button"
        className={btn}
        onClick={(e) => {
          e.stopPropagation();
          void copyWithToast(valueToClipboard(row.value), "Value copied.");
        }}
      >
        Copy value
      </button>
    </span>
  );
}

function MoreRowView({ row, onMore }: { row: MoreRow; onMore: (parentId: string) => void }) {
  const next = Math.min(CHUNK, row.remaining);
  return (
    <div className="relative flex items-center" style={{ height: ROW, paddingLeft: PAD_X + row.depth * INDENT + INDENT }}>
      <Guides depth={row.depth} />
      <button
        type="button"
        onClick={() => onMore(row.parentId)}
        className="h-[18px] rounded-sm px-1.5 text-[11.5px] text-fg3 hover:bg-bg2 hover:text-fg"
      >
        Show {next} more <span className="opacity-70">· {row.remaining.toLocaleString()} hidden</span>
      </button>
    </div>
  );
}
