import { Ellipsis } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MenuContent, MenuItem, MenuSeparator } from "@/features/shell/menu";
import { useWorkspace } from "@/state/workspace";
import { useUi } from "@/state/ui";
import { useAppActions } from "@/state/actions";
import type { Environment } from "@/types";

/** The hover "…" on an environment column header: make active, rename, duplicate, delete. */
export function EnvironmentColumnMenu({ environment }: { environment: Environment }) {
  const ws = useWorkspace();
  const ui = useUi();
  const actions = useAppActions();
  const isActive = ws.workspace.activeEnvironmentId === environment.id;
  const isLast = ws.workspace.environments.length < 2;

  function remove() {
    const restore = ws.deleteEnvironment(environment.id);
    toast(
      <span>
        Deleted <b className="font-medium">{environment.name}</b>.
      </span>,
      { action: { label: "Undo", onClick: restore } },
    );
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Environment actions"
          onClick={(e) => e.stopPropagation()}
          className="ml-auto grid size-5 flex-none cursor-pointer place-items-center rounded-sm text-fg3 opacity-0 group-hover:opacity-100 hover:bg-bg3 hover:text-fg focus-visible:opacity-100 data-[state=open]:bg-bg3 data-[state=open]:text-fg data-[state=open]:opacity-100"
        >
          <Ellipsis className="size-[13px]" />
        </button>
      </DropdownMenuTrigger>
      {/* React events bubble through the portal: keep clicks from reaching the header (which activates the env). */}
      <MenuContent align="end" onClick={(e) => e.stopPropagation()}>
        <MenuItem disabled={isActive} onSelect={() => actions.switchEnvironment(environment.id)}>
          Make active
        </MenuItem>
        <MenuItem onSelect={() => ui.openEnvironmentDialog({ mode: "rename", environmentId: environment.id })}>Rename…</MenuItem>
        <MenuItem onSelect={() => ui.openEnvironmentDialog({ mode: "create", copyFromId: environment.id })}>Duplicate…</MenuItem>
        <MenuSeparator />
        <MenuItem danger disabled={isLast} onSelect={remove}>
          Delete
        </MenuItem>
      </MenuContent>
    </DropdownMenu>
  );
}
