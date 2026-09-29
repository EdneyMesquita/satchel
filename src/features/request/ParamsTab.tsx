import type { KeyValue, SatchelRequest } from "@/types";
import type { VariableContext } from "@/variables";
import { pathParamNames, urlWithParams } from "@/url";
import { VariableInput } from "@/features/variables/VariableInput";
import { KeyValueTable, KV_TD as TD, KV_TH as TH } from "./KeyValueTable";
import { SectionHeader } from "./SectionHeader";
import { autoQueryParams } from "./autoHeaders";

interface ParamsTabProps {
  request: SatchelRequest;
  context: VariableContext;
  update: (updater: (r: SatchelRequest) => SatchelRequest) => void;
}

const newParam = (): KeyValue => ({ key: "", value: "", enabled: true });

export function ParamsTab({ request, context, update }: ParamsTabProps) {
  const names = pathParamNames(request.url);

  // The table is the editor for the query string: rebuild the URL from it.
  const setParams = (params: KeyValue[]) => update((r) => ({ ...r, params, url: urlWithParams(r.url, params) }));
  const setPathValue = (name: string, value: string) =>
    update((r) => ({ ...r, pathVariables: { ...(r.pathVariables ?? {}), [name]: value } }));

  return (
    <>
      {names.length > 0 && (
        <>
          <SectionHeader hint="from :name segments in the URL">Path parameters</SectionHeader>
          <PathParamsTable names={names} values={request.pathVariables ?? {}} context={context} onChange={setPathValue} />
        </>
      )}
      <SectionHeader hint="kept in sync with the URL">Query parameters</SectionHeader>
      <KeyValueTable
        rows={request.params}
        onChange={setParams}
        context={context}
        createRow={newParam}
        keyPlaceholder="Parameter"
        addPlaceholder="Add parameter"
        autoRows={autoQueryParams(request)}
        aria-label="Query parameters"
      />
    </>
  );
}


function PathParamsTable({
  names,
  values,
  context,
  onChange,
}: {
  names: string[];
  values: Record<string, string>;
  context: VariableContext;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <table className="w-full table-fixed border-collapse" aria-label="Path parameters">
      <colgroup>
        <col className="w-9" />
        <col style={{ width: "36%" }} />
        <col />
        <col className="w-[34px]" />
      </colgroup>
      <thead>
        <tr>
          <th className={TH} />
          <th className={TH}>Name</th>
          <th className={TH}>Value</th>
          <th className={TH} />
        </tr>
      </thead>
      <tbody>
        {names.map((name) => (
          <tr key={name} className="hover:bg-bg2">
            <td className={TD} />
            <td className={`${TD} border-r`}>
              <div className="truncate px-2.5 font-mono text-[12.5px] leading-[30px] text-fg">
                <span className="pp cursor-help" data-pp={name}>
                  :{name}
                </span>
              </div>
            </td>
            <td className={TD}>
              <VariableInput
                value={values[name] ?? ""}
                onChange={(v) => onChange(name, v)}
                context={context}
                placeholder="Required"
                inputData={{ "data-path-input": name }}
                aria-label={`Value for :${name}`}
              />
            </td>
            <td className={TD} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}
