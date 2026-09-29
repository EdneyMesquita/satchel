import { File } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useWorkspace, type SaveState } from "@/state/workspace";
import { useUi } from "@/state/ui";
import { cn } from "@/lib/utils";
import { MenuContent, MenuHead, MenuItem } from "./menu";

const SAVE_LABEL: Record<SaveState, string> = {
  saved: "Saved",
  saving: "Saving…",
  cache: "Not saved to a file",
  error: "Couldn't save",
};

function SaveIndicator({ state }: { state: SaveState }) {
  return (
    <span className="flex items-center gap-[5px] text-[11.5px] whitespace-nowrap text-fg3">
      <i
        aria-hidden
        className={cn(
          "size-1.5 rounded-full bg-ok transition-colors duration-200",
          state === "saving" && "animate-[pulse_.8s_ease-in-out_infinite] bg-brass",
          state === "cache" && "bg-fg3",
          state === "error" && "bg-err",
        )}
      />
      <span className="max-[820px]:hidden">{SAVE_LABEL[state]}</span>
    </span>
  );
}

/** Header button showing the workspace file + save state; opens the file menu. */
export function WorkspaceFileMenu() {
  const ws = useWorkspace();
  const ui = useUi();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Workspace file"
          className="flex h-7 min-w-0 cursor-pointer items-center gap-[7px] rounded-md px-2 text-fg2 outline-none hover:bg-bg2 hover:text-fg focus-visible:outline-[1.5px] focus-visible:outline-brass data-[state=open]:bg-bg2 data-[state=open]:text-fg"
        >
          <File className="size-3.5 shrink-0" strokeWidth={1.8} />
          <span className="truncate font-mono text-xs max-[820px]:hidden">{ws.fileName ?? "Untitled workspace"}</span>
          <SaveIndicator state={ws.saveState} />
        </button>
      </DropdownMenuTrigger>
      <MenuContent align="start" className="max-w-[min(480px,calc(100vw-16px))]">
        <MenuHead className="truncate" title={ws.filePath ?? undefined}>
          {ws.filePath ?? "Not saved to a file yet"}
        </MenuHead>
        {!ws.filePath && <MenuItem onSelect={() => void ws.saveFile()}>Save to a file…</MenuItem>}
        <MenuItem onSelect={() => void ws.saveFileAs()}>Save as…</MenuItem>
        <MenuItem onSelect={() => void ws.openFile()}>Open workspace file…</MenuItem>
        <MenuItem onSelect={() => ui.openPostmanDialog()}>Import Postman collection…</MenuItem>
      </MenuContent>
    </DropdownMenu>
  );
}
