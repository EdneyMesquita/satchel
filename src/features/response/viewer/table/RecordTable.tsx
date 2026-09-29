import { memo, useEffect, useRef, type KeyboardEvent } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Marked } from "../Marked";
import { cellText, cellTone, type CellTone, type Column, type Row, type Sort } from "./tableModel";
import { useVirtualRows } from "./useVirtualRows";

const HEADER_HEIGHT = 30;
/** Longer strings are cut in the cell's tooltip too; the inspector has the whole value. */
const TITLE_LIMIT = 500;

/** Plain strings stay in body text; other types take their JSON color (as in Mongo Studio's grid). */
const TONE_CLASS: Record<CellTone, string> = {
  string: "text-fg",
  number: "text-j-n",
  boolean: "text-j-b",
  null: "text-fg3 italic",
  nested: "text-fg3",
  missing: "",
};

interface RecordTableProps {
  rows: readonly Row[];
  /** display order: indices into rows */
  order: readonly number[];
  columns: readonly Column[];
  sort: Sort | null;
  onSort: (key: string) => void;
  /** selected display position */
  selected: number | null;
  onSelect: (position: number) => void;
  /** search: marked text, the positions that match, and the current one */
  query: string;
  matches: ReadonlySet<number>;
  activeMatch: number | null;
  "aria-label": string;
}

/**
 * Records as a grid: a sticky header with each field's type (click to sort),
 * sticky row numbers (the record's index in the response), 24px rows. Only
 * the rows in view render, so a 10,000-item list scrolls like a short one.
 */
export function RecordTable({ rows, order, columns, sort, onSort, selected, onSelect, query, matches, activeMatch, ...aria }: RecordTableProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const virtual = useVirtualRows(scroller, order.length, HEADER_HEIGHT);
  const { reveal } = virtual;

  // Keep the selected (or current search) row in view.
  useEffect(() => {
    if (selected !== null) reveal(selected);
  }, [selected, reveal]);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (order.length === 0) return;
    const last = order.length - 1;
    const page = Math.max(1, Math.floor((scroller.current?.clientHeight ?? 300) / 25) - 1);
    const current = selected ?? -1;
    const next =
      e.key === "ArrowDown" ? Math.min(last, current + 1)
      : e.key === "ArrowUp" ? Math.max(0, current - 1)
      : e.key === "PageDown" ? Math.min(last, current + page)
      : e.key === "PageUp" ? Math.max(0, current - page)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    onSelect(next);
  }

  return (
    <div ref={scroller} tabIndex={0} onKeyDown={onKeyDown} className="relative min-h-0 min-w-0 overflow-auto outline-none">
      <table
        role="grid"
        aria-label={aria["aria-label"]}
        aria-rowcount={order.length + 1}
        className="min-w-full border-separate border-spacing-0 font-mono text-[12.5px] tabular-nums"
      >
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky top-0 left-0 z-[3] h-[30px] w-11 min-w-11 border-r border-b border-line bg-bg0 px-2 text-right font-sans text-xs font-medium text-fg3"
            >
              #
            </th>
            {columns.map((c) => (
              <HeaderCell key={c.key} column={c} sort={sort?.key === c.key ? sort.dir : null} onSort={onSort} />
            ))}
          </tr>
        </thead>
        <tbody>
          {virtual.padTop > 0 && (
            <tr aria-hidden style={{ height: virtual.padTop }}>
              <td colSpan={columns.length + 1} className="p-0" />
            </tr>
          )}
          {order.slice(virtual.start, virtual.end).map((rowIndex, offset) => {
            const position = virtual.start + offset;
            return (
              <RecordRow
                key={rowIndex}
                row={rows[rowIndex]}
                rowIndex={rowIndex}
                position={position}
                columns={columns}
                selected={position === selected}
                matched={matches.has(position)}
                active={position === activeMatch}
                query={query}
                onSelect={onSelect}
              />
            );
          })}
          {virtual.padBottom > 0 && (
            <tr aria-hidden style={{ height: virtual.padBottom }}>
              <td colSpan={columns.length + 1} className="p-0" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function HeaderCell({ column, sort, onSort }: { column: Column; sort: "asc" | "desc" | null; onSort: (key: string) => void }) {
  const Arrow = sort === "desc" ? ArrowDown : ArrowUp;
  return (
    <th
      scope="col"
      aria-sort={sort === "asc" ? "ascending" : sort === "desc" ? "descending" : "none"}
      className="sticky top-0 z-[2] h-[30px] max-w-[280px] border-r border-b border-line bg-bg0 p-0 text-left font-sans text-xs font-medium text-fg"
    >
      <button
        type="button"
        onClick={() => onSort(column.key)}
        title={`${column.key}: ${column.type} — click to sort`}
        className="flex h-full w-full min-w-0 items-center gap-1.5 px-2.5 whitespace-nowrap hover:bg-bg2"
      >
        <span className="min-w-0 truncate">{column.key}</span>
        <span className="flex-none font-mono text-[10.5px] font-normal text-fg3">{column.type}</span>
        <Arrow className={cn("ml-auto size-3 flex-none text-brass", !sort && "invisible")} strokeWidth={2.2} aria-hidden />
      </button>
    </th>
  );
}

interface RecordRowProps {
  row: Row;
  rowIndex: number;
  position: number;
  columns: readonly Column[];
  selected: boolean;
  matched: boolean;
  active: boolean;
  query: string;
  onSelect: (position: number) => void;
}

const RecordRow = memo(function RecordRow({ row, rowIndex, position, columns, selected, matched, active, query, onSelect }: RecordRowProps) {
  const bg = selected ? "bg-bg3" : "group-hover/row:bg-bg2";
  const needle = matched ? query : "";
  return (
    <tr
      data-row={position}
      aria-rowindex={position + 2}
      aria-selected={selected}
      className="group/row cursor-pointer"
      onClick={() => onSelect(position)}
    >
      <td
        className={cn(
          "sticky left-0 z-[1] h-6 w-11 min-w-11 border-r border-b border-line px-2 text-right",
          selected ? "bg-bg3 text-fg" : "bg-bg1 text-fg3 group-hover/row:bg-bg2",
          active && "shadow-[inset_2px_0_0_var(--brass)]",
        )}
      >
        {rowIndex}
      </td>
      {columns.map(({ key }) => {
        const value = row[key];
        const text = cellText(value);
        return (
          <td
            key={key}
            title={text.length > TITLE_LIMIT ? `${text.slice(0, TITLE_LIMIT)}…` : text || undefined}
            className={cn("h-6 max-w-[280px] overflow-hidden border-r border-b border-line px-2.5 text-ellipsis whitespace-nowrap", bg)}
          >
            <span className={TONE_CLASS[cellTone(value)]}>
              <Marked text={text} needle={needle} active={active} />
            </span>
          </td>
        );
      })}
    </tr>
  );
});
