import { toast } from "sonner";
import { errorMessage } from "@/lib/errors";
import { saveTextAs } from "@/saveFile";
import type { ExportExt } from "./exportModel";

const FORMATS: Record<ExportExt, { filter: string; mime: string }> = {
  json: { filter: "JSON", mime: "application/json" },
  xml: { filter: "XML", mime: "application/xml" },
  html: { filter: "HTML", mime: "text/html" },
  csv: { filter: "CSV", mime: "text/csv" },
  txt: { filter: "Text", mime: "text/plain" },
};

/**
 * Save an export and say how it went: "Saved users-2026-10-07.csv" (or
 * "Downloaded …" in the browser). Resolves to true when a file was written,
 * false when the dialog was cancelled or the write failed.
 */
export async function saveExport(text: string, name: string, ext: ExportExt): Promise<boolean> {
  const { filter, mime } = FORMATS[ext];
  try {
    const saved = await saveTextAs(text, { name, filter: { name: filter, extensions: [ext] }, mime });
    if (!saved) return false;
    toast(
      <span>
        {saved.desktop ? "Saved" : "Downloaded"} <b className="font-medium">{saved.name}</b>
      </span>,
    );
    return true;
  } catch (err) {
    toast.error(`Couldn't save ${name}: ${errorMessage(err, "the file couldn't be written.")}`);
    return false;
  }
}
