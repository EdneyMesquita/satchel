import { Upload } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MenuContent, MenuHead, MenuItem, MenuSeparator } from "@/features/shell/menu";
import type { RecordList } from "../table/tableModel";
import { prettyJsonCached } from "../parseJson";
import { ToolbarButton } from "../ToolbarButton";
import { exportFileName, extensionFor, listSummary } from "./exportModel";
import { saveExport } from "./saveExport";

interface ExportMenuProps {
  rawText: string;
  /** the body parsed as JSON: offers "JSON…" (indented) */
  json: boolean;
  /** lists a CSV can be made from; "CSV…" is disabled without one */
  lists: readonly RecordList[];
  /** the request's name, for the file name */
  fileName?: string;
  contentType?: string;
  /** "CSV…" opens the dialog, which the viewer renders outside this menu */
  onCsv: () => void;
  /** the body shown was changed by the post-response script */
  transformed?: boolean;
}

/** The response toolbar's Export button: JSON…, CSV…, Raw body…. JSON and Raw save directly. */
export function ExportMenu({ rawText, json, lists, fileName, contentType, onCsv, transformed }: ExportMenuProps) {
  const jsonName = exportFileName(fileName, "json");
  const rawExt = extensionFor(contentType, json);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ToolbarButton label="Export" className="data-[state=open]:bg-bg2 data-[state=open]:text-fg">
          <Upload />
        </ToolbarButton>
      </DropdownMenuTrigger>
      <MenuContent align="end" className="max-w-[calc(100vw-16px)]">
        <MenuHead>{transformed ? "Export the body as shown (transformed)" : "Export the body"}</MenuHead>
        {json && (
          <MenuItem onSelect={() => void saveExport(prettyJsonCached(rawText), jsonName, "json")} sub={<span className="font-mono">{jsonName}</span>}>
            JSON…
          </MenuItem>
        )}
        <MenuItem disabled={!lists.length} onSelect={onCsv} sub={lists.length ? listSummary(lists[0]) : "no list of records in this body"}>
          CSV…
        </MenuItem>
        <MenuSeparator />
        <MenuItem onSelect={() => void saveExport(rawText, exportFileName(fileName, rawExt), rawExt)} sub="exactly as received">
          Raw body…
        </MenuItem>
      </MenuContent>
    </DropdownMenu>
  );
}
