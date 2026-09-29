import type { ReactNode } from "react";
import { highlightRanges } from "./jsonSearch";
import { cn } from "@/lib/utils";

interface MarkedProps {
  text: string;
  /** case-insensitive text to mark; "" for none */
  needle: string;
  /** the current match: solid brass instead of the soft tint */
  active?: boolean;
}

/** Text with every occurrence of `needle` wrapped in a <mark>. */
export function Marked({ text, needle, active }: MarkedProps) {
  if (!needle) return <>{text}</>;
  const ranges = highlightRanges(text, needle);
  if (!ranges.length) return <>{text}</>;
  const out: ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([a, b], i) => {
    if (a > pos) out.push(text.slice(pos, a));
    out.push(
      <mark key={i} className={cn("rounded-[2px] text-inherit", active ? "bg-brass text-brass-ink" : "bg-brass-soft")}>
        {text.slice(a, b)}
      </mark>,
    );
    pos = b;
  });
  if (pos < text.length) out.push(text.slice(pos));
  return <>{out}</>;
}
