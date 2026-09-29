import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { copyWithToast } from "../copy";
import { displayPath, type JsonPath } from "../jsonPath";
import type { SearchScope } from "../jsonSearch";
import { JsonTree } from "../JsonTree";
import { ToolbarButton } from "../ToolbarButton";
import { RecordTable } from "./RecordTable";
import { inferColumns, matchingRows, nextSort, sortedOrder, toCsv, VALUE_COLUMN, type RecordList, type Sort } from "./tableModel";

/** Below this width the inspector goes under the grid instead of beside it. */
const STACK_BELOW = 760;

/**
 * Table state, owned by ResponseViewer so the shared search bar can count and
 * step through matching rows: which list, the sort, the selected row.
 */
export function useTableState(lists: readonly RecordList[], query: string, scope: SearchScope) {
  const [listIndex, setListIndex] = useState(0);
  const [sort, setSort] = useState<Sort | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  // A new response brings new lists: start over (adjusting state during render, not in an effect).
  const [owner, setOwner] = useState(lists);
  if (owner !== lists) {
    setOwner(lists);
    setListIndex(0);
    setSort(null);
    setSelected(null);
  }
  const list = lists[Math.min(listIndex, lists.length - 1)] as RecordList | undefined;
  const rows = list?.rows ?? [];
  const columns = useMemo(() => inferColumns(rows), [rows]);
  const order = useMemo(() => sortedOrder(rows, sort), [rows, sort]);
  const matches = useMemo(() => matchingRows(rows, order, columns, query, scope), [rows, order, columns, query, scope]);

  return {
    lists,
    listIndex,
    list,
    columns,
    order,
    sort,
    matches,
    selected,
    setSelected,
    chooseList: (i: number) => {
      setListIndex(i);
      setSort(null);
      setSelected(null);
    },
    toggleSort: (key: string) => {
      setSort((s) => nextSort(s, key));
      setSelected(null);
    },
    clearSort: () => setSort(null),
    csv: () => (list ? toCsv(rows, order, columns) : ""),
  };
}

export type TableState = ReturnType<typeof useTableState>;

interface TableViewProps {
  table: TableState;
  query: string;
  /** current match, as an index into table.matches */
  activeMatch: number;
}

/** The records grid with a strip on top (which list, counts, sort) and the selected record's inspector. */
export function TableView({ table, query, activeMatch }: TableViewProps) {
  const { list, columns, order, sort, matches, selected, setSelected } = table;
  const activePosition = query && matches.length ? matches[Math.min(activeMatch, matches.length - 1)] : null;
  const matchSet = useMemo(() => new Set(matches), [matches]);

  // Stepping through search results selects the matching row.
  useEffect(() => {
    if (activePosition !== null) setSelected(activePosition);
  }, [activePosition, setSelected]);

  const box = useRef<HTMLDivElement>(null);
  const [stacked, setStacked] = useState(false);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setStacked(el.clientWidth < STACK_BELOW));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!list) return null;
  const rowIndex = selected !== null ? order[selected] : null;
  const record = rowIndex !== null ? list.rows[rowIndex] : undefined;
  const recordValue = record && list.primitive ? record[VALUE_COLUMN] : record;
  const recordPath: JsonPath | null = rowIndex !== null ? [...list.path, rowIndex] : null;

  return (
    <div className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[28px_minmax(0,1fr)]">
      <TableStrip table={table} />
      <div ref={box} className={cn("flex min-h-0 min-w-0", stacked && "flex-col")}>
        <div className="grid min-h-0 min-w-0 flex-1">
          <RecordTable
            rows={list.rows}
            order={order}
            columns={columns}
            sort={sort}
            onSort={table.toggleSort}
            selected={selected}
            onSelect={setSelected}
            query={query}
            matches={matchSet}
            activeMatch={activePosition}
            aria-label={`Rows from ${displayPath(list.path) || "the response"}`}
          />
        </div>
        {recordPath && (
          <RecordInspector
            path={recordPath}
            value={recordValue}
            stacked={stacked}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}

/** "Rows from data · 500 rows · 8 columns · sorted by name ↑" */
function TableStrip({ table }: { table: TableState }) {
  const { lists, listIndex, list, columns, sort } = table;
  if (!list) return null;
  const n = list.rows.length;
  return (
    <div className="flex min-w-0 items-center gap-2 border-b border-line bg-bg0 px-3 text-[11.5px] whitespace-nowrap text-fg3">
      {lists.length > 1 ? (
        <label className="flex items-center gap-1.5">
          Rows from
          <select
            value={listIndex}
            onChange={(e) => table.chooseList(Number(e.target.value))}
            className="h-5 max-w-[220px] cursor-pointer rounded-sm border border-line2 bg-bg1 px-1 font-mono text-[11.5px] text-fg outline-none focus:border-brass-line"
          >
            {lists.map((l, i) => (
              <option key={i} value={i}>
                {displayPath(l.path) || "(root)"} · {l.rows.length}
              </option>
            ))}
          </select>
        </label>
      ) : (
        list.path.length > 0 && (
          <span>
            Rows from <span className="font-mono text-fg2">{displayPath(list.path)}</span>
          </span>
        )
      )}
      <span>
        {n.toLocaleString()} {n === 1 ? "row" : "rows"} · {columns.length} {columns.length === 1 ? "column" : "columns"}
      </span>
      {sort && (
        <span className="flex min-w-0 items-center gap-1">
          · sorted by <span className="truncate font-mono text-fg2">{sort.key}</span> {sort.dir === "asc" ? "↑" : "↓"}
          <button type="button" onClick={table.clearSort} className="ml-1 text-fg2 underline decoration-line2 underline-offset-2 hover:text-fg">
            clear
          </button>
        </span>
      )}
    </div>
  );
}

interface RecordInspectorProps {
  path: JsonPath;
  value: unknown;
  stacked: boolean;
  onClose: () => void;
}

/** The selected record as a tree, beside the grid (under it on narrow panes). */
function RecordInspector({ path, value, stacked, onClose }: RecordInspectorProps) {
  const shown = displayPath(path);
  return (
    <aside
      aria-label="Selected row"
      className={cn(
        "grid min-h-0 min-w-0 flex-none grid-rows-[32px_minmax(0,1fr)] bg-bg1",
        stacked ? "h-[45%] border-t border-line" : "w-[340px] border-l border-line",
      )}
    >
      <header className="flex min-w-0 items-center gap-1.5 border-b border-line pr-1 pl-3">
        <span className="text-xs font-medium text-fg">Row</span>
        <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-fg3" title={shown}>
          {shown}
        </span>
        <ToolbarButton label="Copy row as JSON" onClick={() => void copyWithToast(JSON.stringify(value, null, 2), "Row copied.")}>
          <Copy />
        </ToolbarButton>
        <ToolbarButton label="Close" onClick={onClose}>
          <X />
        </ToolbarButton>
      </header>
      <JsonTree key={shown} root={value} search={null} query="" activeMatch={0} />
    </aside>
  );
}
