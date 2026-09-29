import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
/** "⌘" on macOS, "Ctrl " elsewhere — prefix for shortcut hints. */
export const MOD = IS_MAC ? "⌘" : "Ctrl ";

export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "rounded-sm border border-line2 px-1 font-mono text-[10.5px] leading-4 font-medium whitespace-nowrap text-fg3",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
