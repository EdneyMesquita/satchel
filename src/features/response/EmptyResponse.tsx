import type { ReactNode } from "react";
import { Kbd, MOD } from "@/components/common/Kbd";
import { cn } from "@/lib/utils";

/** Centered placeholder before the first send. */
export function EmptyResponse() {
  return (
    <div className="grid h-full place-items-center p-6 text-center text-fg3">
      <div>
        <div className="mb-1.5 text-[13.5px] text-fg2">No response yet</div>
        Press <Kbd>{MOD}↵</Kbd> to send
      </div>
    </div>
  );
}

/** Short explanatory line in the body area (no body, request error, …). */
export function ResponseNote({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("px-3 py-3.5 text-[12.5px] leading-[1.55] text-fg3", className)}>{children}</div>;
}
