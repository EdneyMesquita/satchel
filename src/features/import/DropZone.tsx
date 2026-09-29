import { Upload } from "lucide-react";
import { Hint, SecondaryButton } from "@/components/common/Modal";
import { cn } from "@/lib/utils";
import { useFileDragging } from "./dragFiles";

/**
 * The dashed "Drop a Postman export here" area. Dropping anywhere on the
 * window is routed by DropImportOverlay; this only lights up while files
 * are being dragged over the window.
 */
export function DropZone({ onChoose }: { onChoose: () => void }) {
  const over = useFileDragging();
  return (
    <div
      className={cn(
        "grid justify-items-center gap-2 rounded-lg border-[1.5px] border-dashed border-line2 bg-bg0 px-4 py-[34px] text-center transition-[border-color,background-color] duration-150",
        over && "border-brass bg-brass-soft",
      )}
    >
      <Upload className="size-[26px] text-fg3" strokeWidth={1.4} />
      <b className="text-sm font-medium">Drop a Postman export here</b>
      <Hint>Collection v2.0 or v2.1 (.json). Environment exports can come along too.</Hint>
      <div className="mt-1.5 flex items-center gap-3">
        <SecondaryButton onClick={onChoose}>Choose files…</SecondaryButton>
      </div>
    </div>
  );
}
