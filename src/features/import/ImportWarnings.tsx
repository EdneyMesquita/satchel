import { Fragment, type ReactNode } from "react";
import { Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImportWarning } from "./importModel";

const AUTH_LABEL: Record<string, string> = { bearer: "Bearer", basic: "Basic", apikey: "API key" };

function Mono({ children }: { children: ReactNode }) {
  return <span className="font-mono text-xs text-fg">{children}</span>;
}

function commaList(items: string[], render: (item: string) => ReactNode) {
  return items.map((item, i) => (
    <Fragment key={item}>
      {i > 0 && ", "}
      {render(item)}
    </Fragment>
  ));
}

function warningText(w: ImportWarning): ReactNode {
  switch (w.kind) {
    case "undefined": {
      const one = w.names.length === 1;
      return (
        <>
          {commaList(w.names, (n) => <Mono>{`{{${n}}}`}</Mono>)} {one ? "isn't" : "aren't"} defined anywhere yet. Attach a
          Postman environment below, or add {one ? "it" : "them"} to an environment after importing.
        </>
      );
    }
    case "scripts":
      return `${w.count} pre-request/test script${w.count === 1 ? "" : "s"} will be skipped. Satchel doesn't run scripts.`;
    case "files":
      return `${w.count} form-data file field${w.count === 1 ? " points" : "s point"} to a path on the exporter's machine. Choose the file again before sending.`;
    case "graphql":
      return (
        <>
          {w.count} GraphQL {w.count === 1 ? "body" : "bodies"} imported as JSON <Mono>{"{ query, variables }"}</Mono>.
        </>
      );
    case "inheritedAuth":
      return `The collection's ${AUTH_LABEL[w.type] ?? w.type} auth was copied to ${w.count} request${w.count === 1 ? "" : "s"} that inherited it.`;
    case "unsupportedAuth": {
      const one = w.types.length === 1;
      return (
        <>
          Auth type{one ? "" : "s"} {commaList(w.types, (t) => <Mono>{t}</Mono>)} {one ? "isn't" : "aren't"} supported yet and{" "}
          {one ? "was" : "were"} set to None.
        </>
      );
    }
  }
}

/** "Before you import": what won't come across exactly as it was in Postman. */
export function ImportWarnings({ warnings }: { warnings: ImportWarning[] }) {
  if (!warnings.length) return null;
  return (
    <>
      <SectionLabel>Before you import</SectionLabel>
      <ul className="m-0 grid list-none gap-1.5 p-0">
        {warnings.map((w) => {
          const bad = w.kind === "undefined";
          const Icon = bad ? TriangleAlert : Info;
          return (
            <li key={w.kind} className="grid grid-cols-[16px_1fr] gap-2 text-[12.5px] leading-[1.5] text-fg2">
              <Icon className={cn("mt-0.5 size-3.5", bad ? "text-err" : "text-fg3")} />
              <span>{warningText(w)}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** Mockup `.pm-sec`: small uppercase section label, pulled toward its content. */
export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="-mb-2 text-[11px] font-medium tracking-[0.04em] text-fg3 uppercase">{children}</div>;
}
