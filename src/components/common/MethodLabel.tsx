import type { HttpMethod } from "@/types";
import { cn } from "@/lib/utils";

export const METHOD_TEXT_CLASS: Record<HttpMethod, string> = {
  GET: "text-m-get",
  POST: "text-m-post",
  PUT: "text-m-put",
  PATCH: "text-m-patch",
  DELETE: "text-m-delete",
  QUERY: "text-m-query",
  HEAD: "text-m-head",
  OPTIONS: "text-m-options",
};

export const METHOD_HINT: Partial<Record<HttpMethod, string>> = {
  QUERY: "GET with a body",
  HEAD: "headers only",
  OPTIONS: "CORS preflight",
};

const SHORT: Partial<Record<HttpMethod, string>> = { DELETE: "DEL", OPTIONS: "OPT" };

interface MethodLabelProps {
  method: HttpMethod;
  /** DEL / OPT instead of DELETE / OPTIONS (sidebar tree) */
  short?: boolean;
  className?: string;
}

/** Colored monospace method name. Size defaults to the 10px tree/tab size; override with className. */
export function MethodLabel({ method, short, className }: MethodLabelProps) {
  return (
    <span className={cn("shrink-0 font-mono text-[10px] leading-none font-semibold tracking-[0.02em]", METHOD_TEXT_CLASS[method], className)}>
      {short ? (SHORT[method] ?? method) : method}
    </span>
  );
}
