import type { ConsoleEntry } from "@/scripts/pipeline";
import { cn } from "@/lib/utils";

const LEVEL_LABEL: Record<ConsoleEntry["level"], string> = { log: "log", info: "info", warn: "warn", error: "error", variable: "variable" };

/** The response's Console tab: what the request's scripts logged, the variables they wrote, and their errors. */
export function ScriptConsole({ entries }: { entries: readonly ConsoleEntry[] }) {
  if (!entries.length) {
    return (
      <div className="grid h-full place-items-center p-6 text-center text-fg3">
        <div>
          <div className="mb-1.5 text-[13.5px] text-fg2">Nothing logged</div>
          <span className="font-mono">console.log()</span> in a script shows up here.
        </div>
      </div>
    );
  }
  return (
    <div role="log" aria-label="Script console" className="font-mono text-xs leading-[18px]">
      {entries.map((e, i) => (
        <div
          key={i}
          className={cn(
            "grid grid-cols-[40px_60px_minmax(0,1fr)] items-start gap-2 border-b border-line px-3 py-[5px]",
            e.level === "error" && "bg-err-soft",
          )}
        >
          <span className="pt-px font-sans text-[11px] text-fg3">{e.phase === "pre" ? "pre" : "post"}</span>
          <span
            className={cn(
              "pt-px font-sans text-[11px] font-medium text-fg3",
              e.level === "warn" && "text-warn",
              e.level === "error" && "text-err",
              e.level === "variable" && "text-brass",
            )}
          >
            {LEVEL_LABEL[e.level]}
          </span>
          <span className={cn("break-words whitespace-pre-wrap text-fg2 select-text", e.level === "error" && "text-err")}>{e.message}</span>
        </div>
      ))}
    </div>
  );
}
