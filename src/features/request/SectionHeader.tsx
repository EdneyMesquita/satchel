import type { ReactNode } from "react";

/** Small uppercase section title above a table, with an optional right-aligned hint. */
export function SectionHeader({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex h-[34px] items-center gap-2 px-3 pt-1.5 text-[11px] font-medium tracking-[0.04em] text-fg3 uppercase">
      {children}
      <span className="flex-1" />
      {hint && <span className="text-xs leading-normal font-normal tracking-normal normal-case">{hint}</span>}
    </div>
  );
}
