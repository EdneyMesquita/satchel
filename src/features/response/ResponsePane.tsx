import { useState, type ReactNode } from "react";
import { useSession, type ResponseEntry, type ResponseTab } from "@/state/session";
import { useWorkspace } from "@/state/workspace";
import type { HttpResponse } from "@/http/send";
import { BurstPanel } from "@/features/burst/BurstPanel";
import { EmptyResponse, ResponseNote } from "./EmptyResponse";
import { HeadersTable } from "./HeadersTable";
import { ResponseMeta } from "./ResponseMeta";
import { ResponseTabs, type ResponseTabItem } from "./ResponseTabs";
import { ResponseViewer } from "./viewer/ResponseViewer";
import { openResponsePopout } from "./popout/transport";
import { snapshotOf } from "./popout/snapshot";
import { ScriptConsole } from "./script/ScriptConsole";
import { ScriptErrorCard, ScriptStrip } from "./script/ScriptNotices";

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
  const stored = session.responseTab(requestId);
  const response = entry?.kind === "ok" ? entry.response : undefined;
  const scriptConsole = entry?.script?.console ?? [];
  // The Console tab exists while the last send's scripts have something to show.
  const tab: ResponseTab = stored === "console" && !scriptConsole.length && !sending ? "body" : stored;

  const tabs: ResponseTabItem[] = [
    { id: "body", label: "Body" },
    { id: "headers", label: "Headers", count: response ? String(response.headers.length) : undefined },
  ];
  if (scriptConsole.length) {
    const errors = scriptConsole.filter((e) => e.level === "error").length;
    tabs.push({ id: "console", label: "Console", count: String(scriptConsole.length), alert: errors > 0 });
  }
  if (run) tabs.push({ id: "burst", label: "Burst", count: run.running ? `${run.results.length}/${run.total}` : undefined });

  return (
    <section aria-label="Response" className="grid min-h-0 min-w-0 grid-rows-[36px_1fr]">
      <ResponseTabs
        tabs={tabs}
        active={tab}
        onSelect={(t) => session.setResponseTab(requestId, t)}
        meta={tab !== "burst" && <ResponseMeta entry={entry} sending={sending} />}
      />
      {/* The body viewer keeps its toolbar pinned and scrolls itself; everything else scrolls here. */}
      <div className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)]">
        {tab === "burst" && run ? (
          <div className="min-h-0 overflow-auto">
            <BurstPanel run={run} />
          </div>
        ) : sending ? (
          <div className="h-[1.5px] origin-left animate-progress self-start bg-brass" />
        ) : !entry ? (
          <EmptyResponse />
        ) : (
          <div key={`${tab}-${entryKey(entry)}`} className="grid min-h-0 min-w-0 animate-fade-in grid-cols-[minmax(0,1fr)]">
            <ResponseBody requestId={requestId} entry={entry} tab={tab} />
          </div>
        )}
      </div>
    </section>
  );
}

function ResponseBody({ requestId, entry, tab }: { requestId: string; entry: ResponseEntry; tab: ResponseTab }): ReactNode {
  const ws = useWorkspace();
  const session = useSession();
  // "Show original" is about this response only: a new one starts transformed.
  const [original, setOriginal] = useState<{ entry: ResponseEntry; on: boolean } | null>(null);
  const showingOriginal = original?.entry === entry && original.on;
  const toConsole = () => session.setResponseTab(requestId, "console");

  if (tab === "console") return <Scroll><ScriptConsole entries={entry.script?.console ?? []} /></Scroll>;
  if (entry.kind === "script-error") {
    const code = entry.line ? ws.findRequest(requestId)?.request.scripts?.preRequest?.split("\n")[entry.line - 1] : undefined;
    return (
      <Scroll>
        {tab === "headers" ? (
          <ResponseNote>No headers. The pre-request script failed, so the request wasn't sent.</ResponseNote>
        ) : (
          <ScriptErrorCard
            message={entry.message}
            line={entry.line}
            code={code}
            onOpenScript={() => session.setRequestTab(requestId, "scripts")}
            onConsole={toConsole}
          />
        )}
      </Scroll>
    );
  }
  if (entry.kind === "error") {
    return (
      <Scroll>
        {tab === "headers" ? (
          <ResponseNote>No headers. The request failed before a response arrived.</ResponseNote>
        ) : (
          <ResponseNote className="whitespace-pre-wrap text-fg2 select-text">{entry.message}</ResponseNote>
        )}
      </Scroll>
    );
  }
  const script = entry.script;
  const r: HttpResponse =
    showingOriginal && script?.originalBody !== undefined ? { ...entry.response, rawBodyText: script.originalBody } : entry.response;
  if (tab === "headers") {
    return <Scroll>{r.headers.length ? <HeadersTable headers={r.headers} /> : <ResponseNote>The response has no headers.</ResponseNote>}</Scroll>;
  }
  if (r.rawBodyText === "") {
    return (
      <Scroll>
        <ResponseNote>
          {r.status}
          {r.statusText ? ` ${r.statusText}` : ""}. The response has no body.
        </ResponseNote>
      </Scroll>
    );
  }
  const openWindow = () => {
    const loc = ws.findRequest(requestId);
    if (loc) void openResponsePopout(snapshotOf(loc.request, r));
  };
  const contentType = r.headers.find(([k]) => k.toLowerCase() === "content-type")?.[1];
  const viewer = (
    <ResponseViewer
      // a different body (original vs transformed) starts the viewer over
      key={showingOriginal ? "original" : "shown"}
      variant="pane"
      rawText={r.rawBodyText}
      isJson={r.isJson || (showingOriginal && /json/i.test(contentType ?? ""))}
      onOpenWindow={openWindow}
      fileName={ws.findRequest(requestId)?.request.name}
      contentType={contentType}
      transformed={script?.originalBody !== undefined && !showingOriginal}
    />
  );
  if (!script?.postError && script?.originalBody === undefined) return viewer;
  return (
    <div className="grid min-h-0 min-w-0 grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)]">
      <ScriptStrip
        failed={script.postError}
        showingOriginal={showingOriginal}
        onToggle={() => setOriginal({ entry, on: !showingOriginal })}
        onConsole={toConsole}
      />
      {viewer}
    </div>
  );
}

function Scroll({ children }: { children: ReactNode }) {
  return <div className="min-h-0 overflow-auto">{children}</div>;
}
