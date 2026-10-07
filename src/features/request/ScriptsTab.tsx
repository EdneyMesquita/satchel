import { useCallback, useReducer, type ReactNode } from "react";
import { ChevronDown, Info } from "lucide-react";
import type { SatchelRequest } from "@/types";
import { cn } from "@/lib/utils";
import { tokenizeJs, JS_TOKEN_CLASS } from "@/jsTokens";
import { Segmented } from "@/components/common/Segmented";
import { CodeEditor } from "@/components/common/CodeEditor";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MenuContent, MenuHead, MenuItem } from "@/features/shell/menu";
import { SCRIPT_SNIPPETS, appendSnippet, hasScript, type ScriptSide } from "./scriptSnippets";

interface ScriptsTabProps {
  request: SatchelRequest;
  update: (updater: (r: SatchelRequest) => SatchelRequest) => void;
}

/** Past this, JS coloring is skipped: a pasted multi-MB script would mount a span per token. */
const HIGHLIGHT_LIMIT = 50_000;

const GHOST_BUTTON =
  "inline-flex h-[26px] flex-none items-center gap-1.5 rounded-md border border-line2 px-2.5 text-xs whitespace-nowrap text-fg2 hover:bg-bg2 hover:text-fg";

const COPY: Record<ScriptSide, { hint: string; placeholder: string; menuHead: string; label: string }> = {
  preRequest: {
    label: "Pre-request",
    hint: "Runs before the request is sent, with {{variables}} not filled in yet: a variable it sets is used by this request. Change headers, query or body, and read or set variables.",
    placeholder: "// Runs before the request is sent",
    menuHead: "Pre-request snippets",
  },
  postResponse: {
    label: "Post-response",
    hint: "Runs when the response arrives, before it's shown. Read it, reshape what's displayed, and save values to variables.",
    placeholder: "// Runs when the response arrives",
    menuHead: "Post-response snippets",
  },
};

// UI-only memory that outlives the tab being unmounted (switching tabs or requests); not persisted.
const sideByRequest = new Map<string, ScriptSide>();
let apiOpen = false;

function renderJs(value: string): ReactNode {
  if (value.length > HIGHLIGHT_LIMIT) return value;
  return tokenizeJs(value).map((run, i) => (
    <span key={i} className={JS_TOKEN_CLASS[run.kind]}>
      {run.text}
    </span>
  ));
}

/** The request pane's "Scripts" tab: pre-request and post-response JavaScript. */
export function ScriptsTab({ request, update }: ScriptsTabProps) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const scripts = request.scripts ?? {};
  // open on the side that has a script, pre-request when both or neither do
  const side = sideByRequest.get(request.id) ?? (!hasScript(scripts.preRequest) && hasScript(scripts.postResponse) ? "postResponse" : "preRequest");
  const value = scripts[side] ?? "";
  const copy = COPY[side];

  const setSide = (next: ScriptSide) => {
    sideByRequest.set(request.id, next);
    rerender();
  };
  const setScript = useCallback(
    (key: ScriptSide, next: string) => update((r) => ({ ...r, scripts: { ...r.scripts, [key]: next } })),
    [update],
  );

  const sideLabel = (key: ScriptSide) => (
    <>
      {COPY[key].label}
      {hasScript(scripts[key]) && (
        <>
          <span aria-hidden className="ml-1.5 inline-block size-[5px] rounded-full bg-brass align-middle" />
          <span className="sr-only"> (has a script)</span>
        </>
      )}
    </>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-line px-3 py-2">
        <Segmented
          value={side}
          onChange={setSide}
          options={[
            { value: "preRequest", label: sideLabel("preRequest") },
            { value: "postResponse", label: sideLabel("postResponse") },
          ]}
          className="flex-none"
          aria-label="Script"
        />
        <div className="ml-auto flex flex-none items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className={cn(GHOST_BUTTON, "data-[state=open]:bg-bg2 data-[state=open]:text-fg")}>
                Snippets
                <ChevronDown className="size-2.5 text-fg3" strokeWidth={2} />
              </button>
            </DropdownMenuTrigger>
            <MenuContent align="end">
              <MenuHead>{copy.menuHead}</MenuHead>
              {SCRIPT_SNIPPETS[side].map(([label, code]) => (
                <MenuItem key={label} onSelect={() => setScript(side, appendSnippet(value, code))}>
                  {label}
                </MenuItem>
              ))}
            </MenuContent>
          </DropdownMenu>
          <button
            type="button"
            aria-pressed={apiOpen}
            aria-controls="script-api-reference"
            title="Script API reference"
            onClick={() => {
              apiOpen = !apiOpen;
              rerender();
            }}
            className={cn(GHOST_BUTTON, apiOpen && "bg-bg3 text-fg hover:bg-bg3")}
          >
            API
          </button>
        </div>
      </div>
      <div className="px-3 pt-2 text-xs leading-normal text-fg3">{copy.hint}</div>
      {apiOpen && <ApiReference />}
      {/* long lines scroll the editor alone, not the toolbar and notes around it */}
      <div className="overflow-x-auto border-b border-line">
        <CodeEditor
          key={side}
          value={value}
          onChange={(next) => setScript(side, next)}
          renderMirror={renderJs}
          placeholder={copy.placeholder}
          editorClassName="min-h-[220px]"
          aria-label={`${copy.label} script`}
        />
      </div>
      <div className="flex items-start gap-1.5 px-3 py-2 text-[11.5px] leading-normal text-fg3">
        <Info className="mt-px size-3.5 flex-none" strokeWidth={1.4} aria-hidden />
        <span>Runs in a sandbox: no network, files or timers, and it stops after 1{"\u00a0"}s. Saved with the request, so it's shared through git like the rest.</span>
      </div>
    </div>
  );
}

function ApiRow({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-2">
      <b className="font-medium text-brass">{name}</b>
      <span>{children}</span>
    </div>
  );
}

function Aside({ children }: { children: ReactNode }) {
  return <i className="font-sans not-italic text-fg3">{children}</i>;
}

function ApiReference() {
  return (
    <div
      id="script-api-reference"
      className="mx-3 mt-2 rounded-md border border-line bg-bg0 px-2.5 py-2 font-mono text-[11.5px] leading-[1.7] text-fg2"
    >
      <ApiRow name="sat.env">
        get(name) · set(name, value) · unset(name) · name <Aside>— the active environment</Aside>
      </ApiRow>
      <ApiRow name="sat.globals">get(name) · set(name, value)</ApiRow>
      <ApiRow name="sat.variables">
        get(name) <Aside>— resolved: env → collection → globals</Aside>
      </ApiRow>
      <ApiRow name="sat.request">method · url · headers.get/set/remove · query.get/set/remove · body · json() · setJson(obj)</ApiRow>
      <ApiRow name="sat.response">
        status · timeMs · headers.get(name) · text() · json() · setJson(obj) · setBody(text) <Aside>— post-response</Aside>
      </ApiRow>
      <ApiRow name="console">
        log · info · warn · error <Aside>— shown in the response's Console tab</Aside>
      </ApiRow>
    </div>
  );
}
