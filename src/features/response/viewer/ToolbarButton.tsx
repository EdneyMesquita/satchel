import type { ComponentProps, ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface ToolbarButtonProps extends ComponentProps<"button"> {
  /** tooltip and accessible name */
  label: string;
  /** optional shortcut hint after the label */
  hint?: ReactNode;
  pressed?: boolean;
}

/** 24px ghost icon button with a tooltip, for the viewer toolbar and search bar. */
export function ToolbarButton({ label, hint, pressed, className, children, ...props }: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          aria-pressed={pressed}
          className={cn(
            "grid size-6 flex-none cursor-pointer place-items-center rounded-md text-fg3 hover:bg-bg2 hover:text-fg disabled:cursor-default disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-fg3 aria-pressed:bg-bg2 aria-pressed:text-fg [&_svg]:size-3.5",
            className,
          )}
          {...props}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4} className="px-2 py-1 text-[11.5px]">
        {label}
        {hint && <span className="ml-1.5 opacity-60">{hint}</span>}
      </TooltipContent>
    </Tooltip>
  );
}
