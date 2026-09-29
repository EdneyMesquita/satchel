import { File as FileIcon } from "lucide-react";
import { MethodLabel } from "@/components/common/MethodLabel";
import { Segmented } from "@/components/common/Segmented";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Field,
  Hint,
  LinkButton,
  SELECT_CONTENT_CLASS,
  SELECT_ITEM_CLASS,
  SELECT_TRIGGER_CLASS,
  TextInput,
} from "@/components/common/Modal";
import type { Collection, HttpMethod } from "@/types";
import { HTTP_METHODS } from "@/types";
import type { PostmanStats } from "@/postman";
import { formatSize, plural, type PickedCollection } from "./importModel";
import { ImportPreviewTree } from "./ImportPreviewTree";

export type ImportDest = "new" | "merge";

interface ImportReviewProps {
  picked: PickedCollection;
  name: string;
  onNameChange: (name: string) => void;
  dest: ImportDest;
  onDestChange: (dest: ImportDest) => void;
  collections: Collection[];
  into: string;
  onIntoChange: (collectionId: string) => void;
  onChangeFile: () => void;
}

/** File row, name + destination, stats and the preview tree. */
export function ImportReview(props: ImportReviewProps) {
  const { picked, name, dest, collections } = props;
  const { analysis } = picked;
  const preview = { ...analysis.collection, name: name.trim() || analysis.collection.name };

  return (
    <>
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-line bg-bg0 px-3 py-2.5 text-[12.5px]">
        <FileIcon className="size-3.5 flex-none" />
        <span className="truncate font-mono">{picked.fileName}</span>
        <span className="whitespace-nowrap text-fg3">· Postman collection · {formatSize(picked.size)}</span>
        <span className="flex-1" />
        <LinkButton className="whitespace-nowrap" onClick={props.onChangeFile}>
          Change file
        </LinkButton>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3 max-[820px]:grid-cols-1">
        <Field label={dest === "merge" ? "Folder name" : "Collection name"} htmlFor="pm-import-name">
          <TextInput id="pm-import-name" value={name} onChange={(e) => props.onNameChange(e.target.value)} />
        </Field>
        <Field label="Import as">
          <Segmented<ImportDest>
            aria-label="Import as"
            value={dest}
            onChange={props.onDestChange}
            options={[
              { value: "new", label: "New collection" },
              ...(collections.length ? [{ value: "merge" as const, label: "Into existing" }] : []),
            ]}
          />
        </Field>
      </div>

      {dest === "merge" && (
        <Field label="Existing collection" htmlFor="pm-import-into">
          <Select value={props.into} onValueChange={props.onIntoChange}>
            <SelectTrigger id="pm-import-into" className={SELECT_TRIGGER_CLASS}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className={SELECT_CONTENT_CLASS}>
              {collections.map((c) => (
                <SelectItem key={c.id} value={c.id} className={SELECT_ITEM_CLASS}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Hint>Collection variables are added only where the target doesn't already define them.</Hint>
        </Field>
      )}

      <ImportStats stats={analysis.stats} />
      <ImportPreviewTree collection={preview} />
    </>
  );
}

function ImportStats({ stats }: { stats: PostmanStats }) {
  const methods = HTTP_METHODS.filter((m) => stats.methods[m]).map((m): [HttpMethod, number] => [m, stats.methods[m]!]);
  const count = (n: number, one: string) => {
    const [, ...word] = plural(n, one).split(" ");
    return (
      <span>
        <b className="font-mono font-medium text-fg">{n}</b> {word.join(" ")}
      </span>
    );
  };
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-fg3">
      {count(stats.requests, "request")}
      {count(stats.folders, "folder")}
      {count(stats.variables, "collection variable")}
      <span className="ml-auto flex gap-2.5">
        {methods.map(([m, n]) => (
          <span key={m}>
            <MethodLabel method={m} /> {n}
          </span>
        ))}
      </span>
    </div>
  );
}
