import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useWorkspace } from "@/state/workspace";
import { useSession } from "@/state/session";
import { useUi } from "@/state/ui";
import { useAppActions } from "@/state/actions";
import { TreeRow, type RowAction } from "./TreeRow";
import { ancestorIds, containerIds, visibleRows, type TreeRowModel } from "./treeRows";

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
  const collections = ws.workspace.collections;

  const [closed, setClosed] = useState<ReadonlySet<string>>(() => new Set());
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const treeRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => visibleRows(collections, filter, closed), [collections, filter, closed]);
  const selectedId = session.activeTab;

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
    }
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

  return (
    <div ref={treeRef} role="tree" aria-label="Collections" onKeyDown={onKeyDown}>
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
        />
      ))}
    </div>
  );
}
