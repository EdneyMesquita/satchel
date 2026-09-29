import { ChevronDown } from "lucide-react";
import { HTTP_METHODS, type HttpMethod } from "@/types";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MethodLabel, METHOD_HINT } from "@/components/common/MethodLabel";
import { MenuContent, MenuItem } from "@/features/shell/menu";

/** The 92px method button at the left of the URL bar. */
export function MethodMenu({ method, onChange }: { method: HttpMethod; onChange: (method: HttpMethod) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Method"
          className="flex w-[92px] flex-none items-center justify-between gap-1.5 rounded-l-[5px] border-r border-line2 pr-2.5 pl-3 outline-offset-[-2px] hover:bg-bg2 data-[state=open]:bg-bg2"
        >
          <MethodLabel method={method} className="text-xs" />
          <ChevronDown className="size-2.5 text-fg3" strokeWidth={2} />
        </button>
      </DropdownMenuTrigger>
      <MenuContent align="start">
        {HTTP_METHODS.map((m) => (
          <MenuItem key={m} sub={METHOD_HINT[m]} className={m === method ? "bg-bg3 text-fg" : undefined} onSelect={() => onChange(m)}>
            <MethodLabel method={m} className="w-[46px]" />
          </MenuItem>
        ))}
      </MenuContent>
    </DropdownMenu>
  );
}
