import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Folder } from "lucide-react";
import { siblingStep } from "@/collectionTree";
import { MethodLabel } from "@/components/common/MethodLabel";
import { useCopyAsCurl } from "@/features/curl/useCopyAsCurl";
import { useWorkspace } from "@/state/workspace";
import { useSession } from "@/state/session";
import { useUi } from "@/state/ui";
import { useAppActions } from "@/state/actions";
import { cn } from "@/lib/utils";
import { TreeRow, type RowAction } from "./TreeRow";
import { ancestorIds, containerIds, visibleRows, type TreeRowModel } from "./treeRows";
import { ROW_INDENT, ROW_PAD, type DragSource, type Drop, type DropIndicator } from "./dropTarget";
import { useTreeDrag } from "./useTreeDrag";

interface CollectionTreeProps {
  filter: string;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  onDelete: (row: TreeRowModel) => void;
  /** Bumped by the sidebar's "Collapse all" button */
  collapseAllKey: number;
}

/** The collections → folders → requests tree, with roving keyboard focus. */
export function CollectionTree({ filter, renamingId, setRenamingId, onDelete, collapseAllKey }: CollectionTreeProps) {
  const ws = useWorkspace();
  const session = useSession();
  const ui = useUi();
  const actions = useAppActions();
  const copyAsCurl = useCopyAsCurl();
  const collections = ws.workspace.collections;

  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [reorderHint, setReorderHint] = useState(false);
  const treeRef = useRef<HTMLDivElement>(null);
  // A row that moved (drag or Alt+↑/↓) gets focus back once the tree has re-rendered.
  const focusAfterRender = useRef<string | null>(null);

  const rows = useMemo(() => visibleRows(collections, filter, closed), [collections, filter, closed]);
  const selectedId = session.activeTab;
  const filtering = filter.trim() !== "";

  const setOpen = (id: string, open: boolean) =>
    setClosed((prev) => {
      if (prev.has(id) === !open) return prev;
      const next = new Set(prev);
      if (open) next.delete(id);
      else next.add(id);
      return next;
    });

  const reveal = (nodeId: string) =>
    setClosed((prev) => {
      const hidden = ancestorIds(collections, nodeId).filter((id) => prev.has(id));
      if (hidden.length === 0) return prev;
      const next = new Set(prev);
      hidden.forEach((id) => next.delete(id));
      return next;
    });

  const hintTimer = useRef(0);
  const showReorderHint = () => {
    setReorderHint(true);
    window.clearTimeout(hintTimer.current);
    hintTimer.current = window.setTimeout(() => setReorderHint(false), 2600);
  };
  useEffect(() => () => window.clearTimeout(hintTimer.current), []);
  useEffect(() => {
    if (!filtering) setReorderHint(false);
  }, [filtering]);

  const drop = (source: DragSource, target: Drop) => {
    if (target.kind === "collection") ws.moveCollection(source.id, target.toIndex);
    else {
      ws.moveNode(source.id, target.target);
      // Dropped into a closed folder/collection: open it so the item stays in sight.
      setOpen(target.target.parentFolderId ?? target.target.collectionId, true);
    }
    focusAfterRender.current = source.id;
  };

  const drag = useTreeDrag({
    treeRef,
    rows,
    collections,
    disabled: filtering,
    onDisabledAttempt: showReorderHint,
    onExpand: (id) => setOpen(id, true),
    onDrop: drop,
  });

  useEffect(() => {
    const id = focusAfterRender.current;
    if (!id) return;
    focusAfterRender.current = null;
    focusRow(id);
  });

  // "Collapse all": every collection and folder closes (the open request stays open in its tab).
  useEffect(() => {
    if (collapseAllKey > 0) setClosed(new Set(containerIds(collections)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on the button press
  }, [collapseAllKey]);

  // Opening a request (tab, palette, new request…) reveals and scrolls to it.
  useEffect(() => {
    if (!selectedId) return;
    reveal(selectedId);
    const frame = requestAnimationFrame(() => {
      treeRef.current?.querySelector(`[data-row-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedId]);

  // A node being renamed (e.g. just created) must be visible.
  useEffect(() => {
    if (renamingId) reveal(renamingId);
  }, [renamingId]);

  const activate = (row: TreeRowModel) => {
    if (row.kind === "request") {
      session.openTab(row.id);
      ui.setSidebarOpen(false);
    } else {
      setOpen(row.id, !row.open);
    }
  };

  const runAction = (row: TreeRowModel, action: RowAction) => {
    const folderId = row.kind === "folder" ? row.id : null;
    switch (action) {
      case "new-request":
        setOpen(row.id, true);
        actions.newRequest(row.collectionId, folderId);
        ui.setSidebarOpen(false);
        break;
      case "new-folder": {
        setOpen(row.id, true);
        setRenamingId(ws.addFolder(row.collectionId, folderId));
        break;
      }
      case "rename":
        setRenamingId(row.id);
        break;
      case "delete":
        onDelete(row);
        break;
      case "copy-curl":
        copyAsCurl(row.id, { resolve: true });
        break;
      case "copy-curl-raw":
        copyAsCurl(row.id, { resolve: false });
        break;
    }
  };

  /** Alt+↑/↓: move the row one step among its siblings (collections among collections). */
  const moveByKey = (row: TreeRowModel, step: -1 | 1) => {
    if (filtering) {
      showReorderHint();
      return;
    }
    if (row.kind === "collection") {
      const index = collections.findIndex((c) => c.id === row.id);
      const to = step < 0 ? index - 1 : index + 2;
      if (index < 0 || to < 0 || to > collections.length) return;
      ws.moveCollection(row.id, to);
    } else {
      const target = siblingStep(collections, row.id, step);
      if (!target) return;
      ws.moveNode(row.id, target);
    }
    focusAfterRender.current = row.id;
  };

  const commitRename = (row: TreeRowModel, name: string | null) => {
    setRenamingId(null);
    if (name) {
      if (row.kind === "collection") ws.renameCollection(row.id, name);
      else ws.renameNode(row.collectionId, row.id, name);
    }
    requestAnimationFrame(() => focusRow(row.id));
  };

  const focusRow = (id: string) =>
    treeRef.current?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(id)}"]`)?.focus();

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (!target.matches("[data-tree-row]")) return;
    const index = rows.findIndex((r) => r.id === target.dataset.rowId);
    const row = rows[index];
    if (!row) return;
    const move = (to: number) => {
      const next = rows[Math.max(0, Math.min(rows.length - 1, to))];
      if (next) focusRow(next.id);
    };
    if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      moveByKey(row, e.key === "ArrowUp" ? -1 : 1);
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        move(index + 1);
        break;
      case "ArrowUp":
        move(index - 1);
        break;
      case "Home":
        move(0);
        break;
      case "End":
        move(rows.length - 1);
        break;
      case "ArrowRight":
        if (row.kind !== "request") {
          if (!row.open) setOpen(row.id, true);
          else move(index + 1);
        }
        break;
      case "ArrowLeft":
        if (row.kind !== "request" && row.open) setOpen(row.id, false);
        else {
          const parent = row.kind === "collection" ? null : (row.parentId ?? row.collectionId);
          if (parent) focusRow(parent);
        }
        break;
      case "Enter":
      case " ":
        activate(row);
        break;
      case "F2":
        setRenamingId(row.id);
        break;
      case "ContextMenu":
        setMenuFor(row.id);
        break;
      default:
        if (e.key === "F10" && e.shiftKey) {
          setMenuFor(row.id);
          break;
        }
        return;
    }
    e.preventDefault();
  };

  if (collections.length === 0) {
    return (
      <div className="px-4 py-[18px] text-[12.5px] leading-[1.55] text-fg3">
        No collections yet.
        <br />
        Paste a cURL, import a Postman export, or create a request. Everything lands here.
      </div>
    );
  }
  if (rows.length === 0) {
    return <div className="px-4 py-[18px] text-[12.5px] leading-[1.55] text-fg3">Nothing matches “{filter}”.</div>;
  }

  const tabStopId = rows.some((r) => r.id === selectedId) ? selectedId : rows[0].id;

  const indicator = drag.drop?.indicator;
  const dragged = drag.source && rows.find((r) => r.id === drag.source?.id);

  return (
    <div
      ref={treeRef}
      role="tree"
      aria-label="Collections"
      aria-describedby={reorderHint ? "tree-reorder-hint" : undefined}
      onKeyDown={onKeyDown}
      onMouseDown={drag.onMouseDown}
      onClickCapture={drag.onClickCapture}
      className="relative"
    >
      {reorderHint && (
        <div
          id="tree-reorder-hint"
          role="status"
          className="sticky top-0 z-10 mx-2 mb-1 rounded-md bg-bg2 px-2 py-1 text-[11.5px] leading-[1.45] text-fg2 shadow-pop"
        >
          Clear the filter to reorder: while filtering, the tree doesn’t show the real order.
        </div>
      )}
      {rows.map((row) => (
        <TreeRow
          key={row.id}
          row={row}
          selected={row.kind === "request" && row.id === selectedId}
          tabStop={row.id === tabStopId}
          renaming={row.id === renamingId}
          menuOpen={menuFor === row.id}
          onMenuOpenChange={(open) => setMenuFor(open ? row.id : null)}
          onActivate={() => activate(row)}
          onRenameDone={(name) => commitRename(row, name)}
          onAction={(action) => runAction(row, action)}
          dropInside={indicator?.type === "inside" && indicator.rowId === row.id}
          dragging={drag.source?.id === row.id}
        />
      ))}
      {indicator?.type === "line" && <DropLine treeRef={treeRef} indicator={indicator} />}
      {drag.source &&
        createPortal(
          <>
            {/* Catches the pointer during a drag: one cursor everywhere, no hover effects underneath. */}
            <div aria-hidden className={cn("fixed inset-0 z-[90]", drag.drop ? "cursor-grabbing" : "cursor-no-drop")} />
            <div
              ref={drag.previewRef}
              aria-hidden
              className="pointer-events-none fixed top-0 left-0 z-[91] flex h-7 max-w-[240px] items-center gap-1.5 rounded-md bg-bg1 px-2 text-[13px] whitespace-nowrap text-fg shadow-pop"
            >
              {dragged?.kind === "request" ? (
                <MethodLabel method={dragged.request.method} short />
              ) : dragged?.kind === "folder" ? (
                <Folder className="size-3.5 shrink-0 text-fg3" strokeWidth={1.9} />
              ) : null}
              <span className={cn("min-w-0 truncate", dragged?.kind === "collection" && "font-medium")}>
                {dragged ? (dragged.kind === "request" ? dragged.request.name : dragged.name) : ""}
              </span>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

/** The 2px brass line between rows, indented to the depth the item would land at. */
function DropLine({ treeRef, indicator }: { treeRef: RefObject<HTMLDivElement | null>; indicator: Extract<DropIndicator, { type: "line" }> }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const line = ref.current;
    const row = treeRef.current?.querySelector<HTMLElement>(`[data-row-id="${CSS.escape(indicator.rowId)}"]`);
    if (!line) return;
    line.style.visibility = row ? "" : "hidden";
    if (row) line.style.top = `${row.offsetTop + (indicator.edge === "bottom" ? row.offsetHeight : 0) - 1}px`;
  });
  return (
    <div
      ref={ref}
      aria-hidden
      style={{ left: ROW_PAD + indicator.depth * ROW_INDENT }}
      className="pointer-events-none absolute right-1.5 z-10 h-0.5 rounded-full bg-brass before:absolute before:-top-0.5 before:-left-1.5 before:size-1.5 before:rounded-full before:border-[1.5px] before:border-brass before:bg-bg0"
    />
  );
}
