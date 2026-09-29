import type { KeyboardEvent, ReactNode, Ref } from "react";
import { ChevronDown, ChevronUp, Search, X } from "lucide-react";
import { Segmented } from "@/components/common/Segmented";
import { cn } from "@/lib/utils";
import type { SearchScope } from "./jsonSearch";
import { ToolbarButton } from "./ToolbarButton";

const SCOPES: { value: SearchScope; label: string }[] = [
  { value: "all", label: "All" },
  { value: "keys", label: "Keys" },
  { value: "values", label: "Values" },
];

interface SearchBarProps {
  inputRef?: Ref<HTMLInputElement>;
  value: string;
  onChange: (value: string) => void;
  scope: SearchScope;
  onScope: (scope: SearchScope) => void;
  /** show the All | Keys | Values switch (JSON only) */
  showScope: boolean;
  /** matches for the current (debounced) query; null while there's no query */
  count: number | null;
  capped?: boolean;
  active: number;
  onNext: () => void;
  onPrev: () => void;
  /** Esc: clear the query, or close the bar (pane) */
  onEscape: () => void;
  /** pane only: an explicit close button */
  onClose?: () => void;
  /** extra control before the counter ("Show in Tree") */
  aside?: ReactNode;
  className?: string;
}

/** Search input + match counter + ↑/↓ + scope. Enter = next, Shift+Enter = previous. */
export function SearchBar({
  inputRef,
  value,
  onChange,
  scope,
  onScope,
  showScope,
  count,
  capped,
  active,
  onNext,
  onPrev,
  onEscape,
  onClose,
  aside,
  className,
}: SearchBarProps) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (e.shiftKey) onPrev();
      else onNext();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onEscape();
    }
  };
  const has = count !== null && count > 0;

  return (
    <div className={cn("flex min-w-0 items-center gap-1", className)}>
      <label className="flex h-6 min-w-0 flex-1 items-center gap-1.5 rounded-md border border-line bg-bg0 pr-1 pl-2 text-fg3 focus-within:border-line2 hover:border-line2">
        <Search className="size-3.5 flex-none" aria-hidden />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Search keys and values, or a path like data[0].name"
          aria-label="Search the response body"
          spellCheck={false}
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-[12.5px] text-fg outline-none placeholder:text-fg3"
        />
        {aside}
        {count !== null && (
          <span className={cn("flex-none text-[11.5px] whitespace-nowrap tabular-nums", has ? "text-fg3" : "text-fg2")} aria-live="polite">
            {has ? `${active + 1} of ${count}${capped ? "+" : ""}` : "No matches"}
          </span>
        )}
      </label>
      {showScope && <Segmented size="sm" value={scope} onChange={onScope} options={SCOPES} aria-label="Search in" className="flex-none" />}
      <ToolbarButton label="Previous match" hint="⇧↵" onClick={onPrev} disabled={!has}>
        <ChevronUp />
      </ToolbarButton>
      <ToolbarButton label="Next match" hint="↵" onClick={onNext} disabled={!has}>
        <ChevronDown />
      </ToolbarButton>
      {onClose && (
        <ToolbarButton label="Close search" hint="Esc" onClick={onClose}>
          <X />
        </ToolbarButton>
      )}
    </div>
  );
}
