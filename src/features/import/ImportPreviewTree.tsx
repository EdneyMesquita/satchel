import { ChevronRight } from "lucide-react";
import { MethodLabel } from "@/components/common/MethodLabel";
import { visibleRows } from "@/features/sidebar/treeRows";
import type { Collection } from "@/types";
import { cn } from "@/lib/utils";

const NO_CLOSED: ReadonlySet<string> = new Set();

/** Read-only, fully expanded tree of what's about to be imported (sidebar row metrics, 26px rows). */
export function ImportPreviewTree({ collection }: { collection: Collection }) {
  const rows = visibleRows([collection], "", NO_CLOSED);
  return (
    <div className="max-h-[190px] overflow-auto rounded-lg border border-line bg-bg0 py-1" aria-label="Import preview">
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex h-[26px] items-center gap-1.5 pr-1.5 whitespace-nowrap text-fg2 select-none"
          style={{ paddingLeft: 8 + row.depth * 18 }}
        >
          {row.kind === "request" ? (
            <>
              <MethodLabel method={row.request.method} short className="w-[38px] text-left" />
              <span className="min-w-0 flex-1 truncate">{row.request.name}</span>
            </>
          ) : (
            <>
              <span className="grid size-3 flex-none rotate-90 place-items-center text-fg3">
                <ChevronRight className="size-2.5" strokeWidth={2.6} />
              </span>
              <span className={cn("min-w-0 flex-1 truncate", row.kind === "collection" && "font-medium text-fg")}>{row.name}</span>
              <span className="text-[11px] text-fg3">{row.count}</span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
