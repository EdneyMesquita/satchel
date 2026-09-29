import { useMemo } from "react";
import type { KeyValue, SatchelRequest } from "@/types";
import { mergedVariables, type VariableContext } from "@/variables";
import { KeyValueTable } from "./KeyValueTable";
import { SectionHeader } from "./SectionHeader";
import { autoHeaders } from "./autoHeaders";

interface HeadersTabProps {
  request: SatchelRequest;
  context: VariableContext;
  update: (updater: (r: SatchelRequest) => SatchelRequest) => void;
}

const newHeader = (): KeyValue => ({ key: "", value: "", enabled: true });

export function HeadersTab({ request, context, update }: HeadersTabProps) {
  const auto = useMemo(() => autoHeaders(request, mergedVariables(context)), [request, context]);
  return (
    <>
      <SectionHeader>Headers</SectionHeader>
      <KeyValueTable
        rows={request.headers}
        onChange={(headers) => update((r) => ({ ...r, headers }))}
        context={context}
        createRow={newHeader}
        keyHeader="Header"
        keyPlaceholder="Header"
        addPlaceholder="Add header"
        autoRows={auto}
        aria-label="Headers"
      />
    </>
  );
}
