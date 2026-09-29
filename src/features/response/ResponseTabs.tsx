import type { ReactNode } from "react";
import type { ResponseTab } from "@/state/session";
import { cn } from "@/lib/utils";

export interface ResponseTabItem {
  id: ResponseTab;
  label: string;
  /** small fg3 count after the label (header count, "n/total") */
  count?: string;
}

interface ResponseTabsProps {
  tabs: ResponseTabItem[];
  active: ResponseTab;
  onSelect: (tab: ResponseTab) => void;
  /** right-aligned content (status, time, size) */
  meta?: ReactNode;
}

/** 36px subtab bar with the 1.5px brass underline on the active tab. */
export function ResponseTabs({ tabs, active, onSelect, meta }: ResponseTabsProps) {
  return (
    <div role="tablist" aria-label="Response" className="flex items-stretch gap-0.5 overflow-x-auto border-b border-line px-2 scrollbar-none">
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onSelect(t.id)}
            className={cn(
              "relative flex flex-none items-center gap-[5px] px-2 whitespace-nowrap text-fg3 hover:text-fg",
              on && "text-fg after:absolute after:inset-x-2 after:-bottom-px after:h-[1.5px] after:rounded-[2px] after:bg-brass",
            )}
          >
            {t.label}
            {t.count !== undefined && <span className="text-[11px] text-fg3">{t.count}</span>}
          </button>
        );
      })}
      <span className="min-w-2 flex-1" />
      {meta}
    </div>
  );
}
