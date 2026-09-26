import type { KeyValue } from "../types";

export function KvEditor({ rows, onChange }: { rows: KeyValue[]; onChange: (rows: KeyValue[]) => void }) {
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
          <input placeholder="Value" value={row.value} onChange={(e) => update(i, { value: e.target.value })} />
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
