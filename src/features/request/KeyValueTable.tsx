import { useLayoutEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import type { KeyValue } from "@/types";
import type { VariableContext } from "@/variables";
import { Checkmark } from "@/components/common/Checkmark";
import { cn } from "@/lib/utils";
import { VariableInput, VariableText } from "@/features/variables/VariableInput";
import type { AutoRow } from "./autoHeaders";

type Field = "key" | "value";

export interface KeyValueTableProps<T extends KeyValue> {
  rows: T[];
  onChange: (rows: T[]) => void;
  context: VariableContext;
  /** Builds the row appended when typing in the trailing "new row" */
  createRow: () => T;
  keyHeader?: string;
  valueHeader?: string;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  /** Placeholder of the trailing new-row key input, e.g. "Add header" */
  addPlaceholder?: string;
  /** Read-only rows Satchel adds itself, listed after the editable ones */
  autoRows?: AutoRow[];
  /** Extra 72px column after the key (form-data Type) */
  typeColumn?: { header: string; render: (row: T, update: (row: T) => void) => ReactNode };
  /** Replaces the value input for some rows (form-data file cells); return undefined to keep the input */
  renderValue?: (row: T, update: (row: T) => void) => ReactNode | undefined;
  "aria-label"?: string;
}

export const KV_TH = "h-7 px-2.5 text-left font-sans text-[11px] font-medium text-fg3 border-b border-line";
export const KV_TD = "h-[30px] p-0 align-middle border-b border-line";

/** The editable key/value grid used by Params, Headers and form bodies. */
export function KeyValueTable<T extends KeyValue>({
  rows,
  onChange,
  context,
  createRow,
  keyHeader = "Key",
  valueHeader = "Value",
  keyPlaceholder = "Key",
  valuePlaceholder = "Value",
  addPlaceholder = "Add",
  autoRows = [],
  typeColumn,
  renderValue,
  "aria-label": ariaLabel,
}: KeyValueTableProps<T>) {
  const tableRef = useRef<HTMLTableElement>(null);
  const pendingFocus = useRef<{ index: number; field: Field } | null>(null);

  // After a row is appended from the new-row inputs, move focus (caret at the end) into it.
  useLayoutEffect(() => {
    const p = pendingFocus.current;
    if (!p) return;
    pendingFocus.current = null;
    const el = tableRef.current?.querySelector<HTMLInputElement>(`[data-kv-cell="${p.index}:${p.field}"]`);
    if (!el) return;
    el.focus();
    const n = el.value.length;
    el.setSelectionRange(n, n);
  });

  const update = (index: number, row: T) => onChange(rows.map((r, i) => (i === index ? row : r)));
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const append = (field: Field, text: string) => {
    const row = { ...createRow(), [field]: text };
    pendingFocus.current = { index: rows.length, field };
    onChange([...rows, row]);
  };

  const form = Boolean(typeColumn);

  return (
    <table ref={tableRef} aria-label={ariaLabel} className="w-full table-fixed border-collapse">
      <colgroup>
        <col className="w-9" />
        <col style={{ width: form ? "26%" : "36%" }} />
        {form && <col className="w-[72px]" />}
        <col />
        <col className="w-[34px]" />
      </colgroup>
      <thead>
        <tr>
          <th className={KV_TH} />
          <th className={KV_TH}>{keyHeader}</th>
          {form && <th className={KV_TH}>{typeColumn!.header}</th>}
          <th className={KV_TH}>{valueHeader}</th>
          <th className={KV_TH} />
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => {
          const set = (r: T) => update(i, r);
          const custom = renderValue?.(row, set);
          return (
            <tr key={i} className="group hover:bg-bg2">
              <td className={cn(KV_TD, "pl-3")}>
                <Checkmark checked={row.enabled} onChange={(enabled) => set({ ...row, enabled })} label={row.enabled ? "Disable" : "Enable"} />
              </td>
              <td className={cn(KV_TD, "border-r")}>
                <VariableInput
                  value={row.key}
                  onChange={(key) => set({ ...row, key })}
                  context={context}
                  placeholder={keyPlaceholder}
                  dimmed={!row.enabled}
                  inputData={{ "data-kv-cell": `${i}:key` }}
                  aria-label={keyHeader}
                />
              </td>
              {form && <td className={cn(KV_TD, "border-r px-1.5")}>{typeColumn!.render(row, set)}</td>}
              <td className={KV_TD}>
                {custom !== undefined ? (
                  custom
                ) : (
                  <VariableInput
                    value={row.value}
                    onChange={(value) => set({ ...row, value })}
                    context={context}
                    placeholder={valuePlaceholder}
                    dimmed={!row.enabled}
                    inputData={{ "data-kv-cell": `${i}:value` }}
                    aria-label={valueHeader}
                  />
                )}
              </td>
              <td className={KV_TD}>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  aria-label="Remove"
                  className="mx-auto grid size-[22px] place-items-center rounded-sm text-fg3 opacity-0 group-hover:opacity-100 hover:bg-bg3 hover:text-fg focus-visible:opacity-100"
                >
                  <X className="size-2.5" strokeWidth={2.5} />
                </button>
              </td>
            </tr>
          );
        })}

        <tr>
          <td className={KV_TD} />
          <td className={cn(KV_TD, "border-r")}>
            <VariableInput
              value=""
              onChange={(text) => append("key", text)}
              context={context}
              placeholder={addPlaceholder}
              inputClassName="placeholder:opacity-50"
              aria-label={addPlaceholder}
            />
          </td>
          {form && <td className={cn(KV_TD, "border-r")} />}
          <td className={KV_TD}>
            <VariableInput
              value=""
              onChange={(text) => append("value", text)}
              context={context}
              placeholder={valuePlaceholder}
              inputClassName="placeholder:opacity-50"
              aria-label={`New ${valueHeader.toLowerCase()}`}
            />
          </td>
          <td className={KV_TD} />
        </tr>

        {autoRows.map((row, i) => (
          <tr key={`auto-${i}`} className="hover:bg-bg2">
            <td className={cn(KV_TD, "pl-3")}>
              <span className="rounded-[3px] border border-line2 px-1 font-sans text-[10.5px] leading-[15px] text-fg3">auto</span>
            </td>
            <td className={cn(KV_TD, "border-r")}>
              <div className="truncate px-2.5 font-mono text-[12.5px] leading-[30px] text-fg3">{row.key}</div>
            </td>
            {form && <td className={cn(KV_TD, "border-r")} />}
            <td className={KV_TD}>
              <div className="truncate px-2.5 font-mono text-[12.5px] leading-[30px] whitespace-nowrap text-fg3">
                <VariableText value={row.value} context={context} />
              </div>
            </td>
            <td className={KV_TD} />
          </tr>
        ))}
      </tbody>
    </table>
  );
}
