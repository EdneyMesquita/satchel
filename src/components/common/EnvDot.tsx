import { cn } from "@/lib/utils";

export function EnvDot({ color, className }: { color?: string; className?: string }) {
  return (
    <i
      aria-hidden
      className={cn("inline-block size-[7px] shrink-0 rounded-full", className)}
      style={{ background: color ?? "var(--fg3)" }}
    />
  );
}
