import type { ReactNode } from "react";
import { useSession, type ResponseEntry, type ResponseTab } from "@/state/session";
import type { HttpResponse } from "@/http/send";
import { BurstPanel } from "@/features/burst/BurstPanel";
import { EmptyResponse, ResponseNote } from "./EmptyResponse";
import { HeadersTable } from "./HeadersTable";
import { JsonViewer } from "./JsonViewer";
import { ResponseMeta } from "./ResponseMeta";
import { ResponseTabs, type ResponseTabItem } from "./ResponseTabs";

// Stable per-entry keys, so the body fades in once per new response rather than on every render.
const entryKeys = new WeakMap<object, number>();
let nextKey = 0;
function entryKey(entry: object): number {
  let k = entryKeys.get(entry);
  if (k === undefined) entryKeys.set(entry, (k = ++nextKey));
  return k;
}

/** Right half of the request split: response body/headers, or the burst results. */
export function ResponsePane({ requestId }: { requestId: string }) {
  const session = useSession();
  const entry = session.responses[requestId];
  const sending = !!session.sending[requestId];
  const run = session.bursts[requestId];
  const tab = session.responseTab(requestId);
  const response = entry?.kind === "ok" ? entry.response : undefined;

  const tabs: ResponseTabItem[] = [
    { id: "body", label: "Body" },
    { id: "headers", label: "Headers", count: response ? String(response.headers.length) : undefined },
  ];
  if (run) tabs.push({ id: "burst", label: "Burst", count: run.running ? `${run.results.length}/${run.total}` : undefined });

  return (
    <section aria-label="Response" className="grid min-h-0 min-w-0 grid-rows-[36px_1fr]">
      <ResponseTabs
        tabs={tabs}
        active={tab}
        onSelect={(t) => session.setResponseTab(requestId, t)}
        meta={tab !== "burst" && <ResponseMeta entry={entry} sending={sending} />}
      />
      <div className="min-h-0 overflow-auto">
        {tab === "burst" && run ? (
          <BurstPanel run={run} />
        ) : sending ? (
          <div className="h-[1.5px] origin-left animate-progress bg-brass" />
        ) : !entry ? (
          <EmptyResponse />
        ) : (
          <div key={`${tab}-${entryKey(entry)}`} className="animate-fade-in">
            <ResponseBody entry={entry} tab={tab} />
          </div>
        )}
      </div>
    </section>
  );
}

function ResponseBody({ entry, tab }: { entry: ResponseEntry; tab: ResponseTab }): ReactNode {
  if (entry.kind === "error") {
    return tab === "headers" ? (
      <ResponseNote>No headers. The request failed before a response arrived.</ResponseNote>
    ) : (
      <ResponseNote className="whitespace-pre-wrap text-fg2 select-text">{entry.message}</ResponseNote>
    );
  }
  const r: HttpResponse = entry.response;
  if (tab === "headers") {
    return r.headers.length ? <HeadersTable headers={r.headers} /> : <ResponseNote>The response has no headers.</ResponseNote>;
  }
  if (r.bodyText === "") {
    return (
      <ResponseNote>
        {r.status}
        {r.statusText ? ` ${r.statusText}` : ""}. The response has no body.
      </ResponseNote>
    );
  }
  return <JsonViewer text={r.bodyText} json={r.isJson} />;
}
