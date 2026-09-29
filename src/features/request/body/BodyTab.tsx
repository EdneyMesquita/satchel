import type { ReactNode } from "react";
import { toast } from "sonner";
import type { RequestBody, SatchelRequest } from "@/types";
import type { VariableContext } from "@/variables";
import { isTauri } from "@/platform";
import { Segmented } from "@/components/common/Segmented";
import { MethodLabel } from "@/components/common/MethodLabel";
import { KeyValueTable } from "../KeyValueTable";
import { switchBody } from "../stash";
import { JsonBodyEditor } from "./JsonBodyEditor";
import { FormDataTable } from "./FormDataTable";
import { beautifyJson } from "./json";

interface BodyTabProps {
  request: SatchelRequest;
  context: VariableContext;
  update: (updater: (r: SatchelRequest) => SatchelRequest) => void;
}

const MODES: { value: RequestBody["mode"]; label: string }[] = [
  { value: "none", label: "None" },
  { value: "raw", label: "JSON" },
  { value: "formdata", label: "Form data" },
  { value: "urlencoded", label: "URL-encoded" },
];

export function BodyTab({ request, context, update }: BodyTabProps) {
  const body = request.body;
  const setBody = (next: RequestBody) => update((r) => ({ ...r, body: next }));

  const beautify = () => {
    if (body.mode !== "raw") return;
    const pretty = beautifyJson(body.raw);
    if (pretty === null) {
      toast.error("Invalid JSON. Can't format it yet.");
      return;
    }
    setBody({ ...body, raw: pretty });
    toast("Body formatted.");
  };

  const queryHint = request.method === "QUERY" ? <QueryHint /> : null;
  let content: ReactNode;
  if (body.mode === "raw")
    content = (
      <>
        {queryHint}
        <JsonBodyEditor
          value={body.raw}
          onChange={(raw) => setBody({ ...body, raw })}
          context={context}
          json={body.language === "json"}
          aria-label="Request body"
        />
      </>
    );
  else if (body.mode === "formdata")
    content = (
      <>
        {queryHint}
        <FormDataTable fields={body.fields} onChange={(fields) => setBody({ ...body, fields })} context={context} />
        <div className="px-3 py-2.5 text-xs leading-normal text-fg3">
          Sent as <span className="font-mono">multipart/form-data</span>. Files are read from disk at send time, so edits to the file are picked up.
          {!isTauri() && " Sending files needs the desktop app."}
        </div>
      </>
    );
  else if (body.mode === "urlencoded")
    content = (
      <>
        {queryHint}
        <KeyValueTable
          rows={body.params}
          onChange={(params) => setBody({ ...body, params })}
          context={context}
          createRow={() => ({ key: "", value: "", enabled: true })}
          keyHeader="Field"
          keyPlaceholder="Field"
          addPlaceholder="Add field"
          aria-label="URL-encoded fields"
        />
      </>
    );
  else
    content = (
      <NoBody
        method={request.method}
        onSwitchToQuery={() => update((r) => ({ ...r, method: "QUERY", body: r.body.mode === "none" ? switchBody(r.id, r.body, "raw") : r.body }))}
      />
    );

  return (
    <>
      <div className="flex items-center gap-2 border-b border-line px-3 py-2">
        <Segmented value={body.mode} onChange={(mode) => setBody(switchBody(request.id, body, mode))} options={MODES} aria-label="Body type" />
        <span className="flex-1" />
        {body.mode === "raw" && body.language === "json" && (
          <button
            type="button"
            onClick={beautify}
            className="h-[26px] rounded-md border border-line2 px-2.5 text-xs whitespace-nowrap text-fg2 hover:bg-bg2 hover:text-fg"
          >
            Beautify
          </button>
        )}
      </div>
      {content}
    </>
  );
}

function QueryHint() {
  return (
    <div data-no-hover className="mx-3 mt-2.5 flex gap-2 rounded-md bg-m-query/10 px-2.5 py-2 text-xs leading-normal text-fg2">
      <b className="font-mono text-[11px] leading-[18px] font-semibold text-m-query">QUERY</b>
      <span>
        Safe and idempotent like GET, but the query goes in the body, so it can be cached and retried. Servers list what they accept in{" "}
        <span className="font-mono">Accept-Query</span>.
      </span>
    </div>
  );
}

function NoBody({ method, onSwitchToQuery }: { method: SatchelRequest["method"]; onSwitchToQuery: () => void }) {
  if (method !== "GET" && method !== "HEAD") return <div className="px-3 py-3.5 text-[12.5px] leading-[1.55] text-fg3">This request has no body.</div>;
  return (
    <div className="px-3 py-3.5 text-[12.5px] leading-[1.55] text-fg3">
      {method} requests don't carry a body.
      {method === "GET" && (
        <>
          {" "}
          To send a body on a safe, cacheable read, use <MethodLabel method="QUERY" className="text-[11px] leading-[inherit]" />.
          <div className="mt-2.5">
            <button
              type="button"
              onClick={onSwitchToQuery}
              className="h-[26px] rounded-md border border-line2 px-2.5 text-xs whitespace-nowrap text-fg2 hover:bg-bg2 hover:text-fg"
            >
              Switch to QUERY
            </button>
          </div>
        </>
      )}
    </div>
  );
}
