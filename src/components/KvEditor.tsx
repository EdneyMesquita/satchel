import type { KeyValue } from "../types";
import { VariableInput } from "./VariableField";

interface KvEditorProps {
  rows: KeyValue[];
  onChange: (rows: KeyValue[]) => void;
  variables?: KeyValue[];
}

export function KvEditor({ rows, onChange, variables = [] }: KvEditorProps) {
  const update = (index: number, patch: Partial<KeyValue>) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  const remove = (index: number) => onChange(rows.filter((_, i) => i !== index));
  const add = () => onChange([...rows, { key: "", value: "", enabled: true }]);

  return (
    <div className="panel">
      {rows.map((row, i) => (
        <div className="kv-row" key={i}>
          <input type="checkbox" checked={row.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} />
          <input placeholder="Key" value={row.key} onChange={(e) => update(i, { key: e.target.value })} />
          <VariableInput
            className="kv-value"
            placeholder="Value"
            value={row.value}
            variables={variables}
            onChange={(value) => update(i, { value })}
          />
          <button className="remove" onClick={() => remove(i)} aria-label="Remove">
            ×
          </button>
        </div>
      ))}
      <button className="add-row" onClick={add}>
        + Add
      </button>
    </div>
  );
}
