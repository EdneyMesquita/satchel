import { useMemo, useRef, useState } from "react";
import { Segmented } from "@/components/common/Segmented";
import { Field, Modal, ModalBody, ModalFooter, PrimaryButton, SecondaryButton, TextInput } from "@/components/common/Modal";
import type { RecordList } from "../table/tableModel";
import { copyWithToast } from "../copy";
import { csvForList, csvPreview, exportColumns, listLabel, nestedColumns } from "./exportModel";
import { saveExport } from "./saveExport";

interface CsvExportDialogProps {
  lists: readonly RecordList[];
  /** the list to start from (the one the Table view shows) */
  initialList: number;
  /** suggested file name, `<slug>-YYYY-MM-DD.csv` */
  defaultName: string;
  onClose: () => void;
}

/** "Export as CSV": which list (when there's a choice), a preview, the file name; Copy or Save…. */
export function CsvExportDialog({ lists, initialList, defaultName, onClose }: CsvExportDialogProps) {
  const [listIndex, setListIndex] = useState(Math.min(initialList, lists.length - 1));
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<HTMLButtonElement>(null);
  const list = lists[listIndex];
  const columns = useMemo(() => exportColumns(list.rows), [list]);
  const preview = useMemo(() => csvPreview(list, columns), [list, columns]);
  const nested = nestedColumns(columns);
  const n = list.rows.length;

  async function save() {
    const trimmed = name.trim() || defaultName;
    const fileName = /\.[a-z0-9]+$/i.test(trimmed) ? trimmed : `${trimmed}.csv`;
    setSaving(true);
    const saved = await saveExport(csvForList(list, columns), fileName, "csv");
    setSaving(false);
    if (saved) onClose();
  }

  return (
    <Modal
      title="Export as CSV"
      size="sm"
      onClose={onClose}
      // Enter saves right away; the name field is a click away.
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        saveRef.current?.focus();
      }}
    >
      <ModalBody>
        {lists.length > 1 && (
          <Field label="List">
            <Segmented
              value={String(listIndex)}
              onChange={(v) => setListIndex(Number(v))}
              options={lists.map((l, i) => ({ value: String(i), label: listLabel(l) }))}
              aria-label="List to export"
              className="font-mono"
            />
          </Field>
        )}
        <Field label={`Preview · ${n.toLocaleString()} ${n === 1 ? "row" : "rows"} · ${columns.length} ${columns.length === 1 ? "column" : "columns"}`}>
          <pre
            tabIndex={0}
            aria-label="CSV preview"
            className="m-0 max-h-[150px] overflow-auto rounded-md border border-line bg-bg0 px-2.5 py-2 font-mono text-[11.5px] leading-[1.6] whitespace-pre text-fg2 outline-none focus-visible:border-brass-line"
          >
            {preview.text}
            {preview.more && "\n…"}
          </pre>
        </Field>
        <Field label="File name" htmlFor="csv-export-name">
          <TextInput
            id="csv-export-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !saving) {
                e.preventDefault();
                void save();
              }
            }}
            className="font-mono text-[12.5px]"
          />
        </Field>
      </ModalBody>
      <ModalFooter
        hint={
          nested.length
            ? `A column per field, in the records' order. Nested values (${nested.slice(0, 3).join(", ")}${nested.length > 3 ? ", …" : ""}) stay as JSON in their cell.`
            : "A column per field, in the records' order."
        }
      >
        <SecondaryButton onClick={() => void copyWithToast(csvForList(list, columns), "CSV copied.")}>Copy</SecondaryButton>
        <PrimaryButton ref={saveRef} disabled={saving} onClick={() => void save()}>
          Save…
        </PrimaryButton>
      </ModalFooter>
    </Modal>
  );
}
