import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="whitespace-nowrap text-fg2 underline decoration-line2 underline-offset-[3px] hover:text-fg hover:decoration-current"
    >
      {children}
    </button>
  );
}

/** Under the body toolbar: the post-response script changed (or failed on) what's shown. */
export function ScriptStrip({
  failed,
  showingOriginal,
  onToggle,
  onConsole,
}: {
  failed?: { line: number | null } | null;
  showingOriginal: boolean;
  onToggle?: () => void;
  onConsole: () => void;
}) {
  return (
    <div className={cn("flex items-center gap-2 border-b border-line px-3 py-[5px] text-xs", failed ? "bg-err-soft text-err" : "bg-brass-soft text-brass")}>
      <span className="min-w-0">
        {failed
          ? `The post-response script failed${failed.line ? ` at line ${failed.line}` : ""}; this is the response as received.`
          : showingOriginal
            ? "The response as received, before the post-response script."
            : "Changed by the post-response script."}
      </span>
      <span className="flex-1" />
      {failed ? <LinkButton onClick={onConsole}>Console</LinkButton> : onToggle && <LinkButton onClick={onToggle}>{showingOriginal ? "Show transformed" : "Show original"}</LinkButton>}
    </div>
  );
}

/** In place of the body when the pre-request script stopped the send. */
export function ScriptErrorCard({
  message,
  line,
  code,
  onOpenScript,
  onConsole,
}: {
  message: string;
  line: number | null;
  code?: string;
  onOpenScript: () => void;
  onConsole: () => void;
}) {
  return (
    <div role="alert" className="m-3 rounded-lg bg-err-soft px-3.5 py-3 text-[12.5px] leading-[1.55] text-fg2">
      <b className="font-semibold text-err">The pre-request script failed{line ? ` at line ${line}` : ""}.</b> The request wasn't sent.
      {code && <pre className="my-2 font-mono text-xs whitespace-pre-wrap text-fg">{code.trim()}</pre>}
      <div className="font-mono text-xs select-text">{message}</div>
      <div className="mt-2.5 flex gap-3">
        <LinkButton onClick={onOpenScript}>Open the script</LinkButton>
        <LinkButton onClick={onConsole}>See the console</LinkButton>
      </div>
    </div>
  );
}
