import type { ResponseEntry } from "@/state/session";
import { formatSize } from "./format";
import { ErrorPill, StatusPill } from "./StatusPill";

interface ResponseMetaProps {
  entry: ResponseEntry | undefined;
  sending: boolean;
}

/** Right side of the response subtabs: "Sending…", or status · time · size. */
export function ResponseMeta({ entry, sending }: ResponseMetaProps) {
  if (!sending && !entry) return null;
  return (
    <span className="flex items-center gap-2.5 pl-1 text-xs whitespace-nowrap text-fg3">
      {sending ? (
        "Sending…"
      ) : entry!.kind === "error" ? (
        <ErrorPill />
      ) : (
        <>
          <StatusPill status={entry!.response.status} text={entry!.response.statusText} />
          <span className="font-mono text-fg2">{entry!.response.timeMs} ms</span>
          <span className="font-mono text-fg2">{formatSize(entry!.response.sizeBytes)}</span>
        </>
      )}
    </span>
  );
}
