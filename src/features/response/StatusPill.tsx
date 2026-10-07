import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { statusTone, type StatusTone } from "./format";

const TONE_CLASS: Record<StatusTone, string> = {
  ok: "bg-ok-soft text-ok",
  redirect: "bg-[color-mix(in_srgb,var(--m-get)_14%,transparent)] text-m-get",
  client: "bg-brass-soft text-warn",
  error: "bg-err-soft text-err",
};

function Pill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={cn("rounded-sm px-[7px] py-0.5 font-mono text-xs font-semibold", TONE_CLASS[tone])}>{children}</span>;
}

/** "200 OK" colored by status class. */
export function StatusPill({ status, text }: { status: number; text: string }) {
  return (
    <Pill tone={statusTone(status)}>
      {status}
      {text ? ` ${text}` : ""}
    </Pill>
  );
}

/** Shown in place of the status when the request never got a response. */
export function ErrorPill() {
  return <Pill tone="error">Error</Pill>;
}

/** Shown when the pre-request script stopped the send. */
export function NotSentPill() {
  return <Pill tone="error">Not sent</Pill>;
}
