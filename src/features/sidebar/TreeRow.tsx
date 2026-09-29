import { useRef } from "react";
import { ChevronRight, Ellipsis, Plus } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MethodLabel } from "@/components/common/MethodLabel";
import { MenuContent, MenuItem, MenuSeparator } from "@/features/shell/menu";
import { cn } from "@/lib/utils";
import { RenameInput } from "./RenameInput";
import type { TreeRowModel } from "./treeRows";

export type RowAction = "new-request" | "new-folder" | "rename" | "delete";

interface TreeRowProps {
  row: TreeRowModel;
  selected: boolean;
  /** The row that takes Tab focus (roving tabindex) */
  tabStop: boolean;
  renaming: boolean;
  menuOpen: boolean;
  onMenuOpenChange: (open: boolean) => void;
  onActivate: () => void;
  onRenameDone: (name: string | null) => void;
  onAction: (action: RowAction) => void;
}

/** One 28px line of the collection tree: collection, folder or request. */
export function TreeRow({ row, selected, tabStop, renaming, menuOpen, onMenuOpenChange, onActivate, onRenameDone, onAction }: TreeRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  // Set when the menu closes because of a choice or an outside click: then focus shouldn't jump back to the row.
  const skipRefocus = useRef(false);
  const isRequest = row.kind === "request";
  const name = isRequest ? row.request.name : row.name;

  const choose = (action: RowAction) => {
    skipRefocus.current = true;
    onAction(action);
  };

  return (
    <div
      ref={rowRef}
      role="treeitem"
      aria-level={row.depth + 1}
      aria-selected={selected}
      aria-expanded={isRequest ? undefined : row.open}
      data-tree-row=""
      data-row-id={row.id}
      tabIndex={tabStop ? 0 : -1}
      onClick={renaming ? undefined : onActivate}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!renaming) onMenuOpenChange(true);
      }}
      style={{ paddingLeft: 8 + row.depth * 18 }}
      className={cn(
        "group relative flex h-7 cursor-pointer items-center gap-1.5 pr-1.5 whitespace-nowrap text-fg2 select-none hover:bg-bg2 hover:text-fg focus-visible:[outline-offset:-1.5px]",
        selected &&
          "bg-bg3 text-fg hover:bg-bg3 before:absolute before:top-[5px] before:bottom-[5px] before:left-0 before:w-0.5 before:rounded-[2px] before:bg-brass",
      )}
    >
      {isRequest ? (
        <MethodLabel method={row.request.method} short className="w-[38px] text-left" />
      ) : (
        <span
          aria-hidden
          className={cn(
            "grid size-3 flex-none place-items-center text-fg3 transition-transform duration-150 ease-out",
            row.open && "rotate-90",
          )}
        >
          <ChevronRight className="size-2.5" strokeWidth={2.8} />
        </span>
      )}

      {renaming ? (
        <RenameInput initial={name} onDone={onRenameDone} />
      ) : (
        <span className={cn("min-w-0 flex-1 truncate", row.kind === "collection" && "font-medium text-fg")}>{name}</span>
      )}

      {row.kind === "collection" && !renaming && <span className="text-[11px] text-fg3">{row.count}</span>}

      {!renaming && (
        <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              tabIndex={-1}
              aria-label={isRequest ? "More" : "Add"}
              onClick={(e) => e.stopPropagation()}
              className="grid size-5 flex-none cursor-pointer place-items-center rounded-sm text-fg3 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 hover:bg-bg3 hover:text-fg data-[state=open]:bg-bg3 data-[state=open]:text-fg data-[state=open]:opacity-100"
            >
              {isRequest ? <Ellipsis className="size-[13px]" strokeWidth={2.4} /> : <Plus className="size-[13px]" strokeWidth={2.2} />}
            </button>
          </DropdownMenuTrigger>
          <MenuContent
            align="start"
            // React events bubble through portals: keep menu clicks from activating the row.
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.stopPropagation()}
            onInteractOutside={() => {
              skipRefocus.current = true;
            }}
            onCloseAutoFocus={(e) => {
              e.preventDefault();
              if (!skipRefocus.current) rowRef.current?.focus();
              skipRefocus.current = false;
            }}
          >
            {!isRequest && (
              <>
                <MenuItem onSelect={() => choose("new-request")}>New request here</MenuItem>
                <MenuItem onSelect={() => choose("new-folder")}>New folder here</MenuItem>
                <MenuSeparator />
              </>
            )}
            <MenuItem sub="F2" onSelect={() => choose("rename")}>
              Rename
            </MenuItem>
            <MenuItem danger onSelect={() => choose("delete")}>
              Delete
            </MenuItem>
          </MenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
