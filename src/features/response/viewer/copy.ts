import { toast } from "sonner";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { isTauri } from "@/platform";

/** Write text to the clipboard: the web API first, then the Tauri plugin, then execCommand. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // fall through
  }
  if (isTauri()) {
    try {
      await writeText(text);
      return true;
    } catch {
      // fall through
    }
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}

/** Copy and confirm with a toast ("Body copied."). */
export async function copyWithToast(text: string, message: string): Promise<void> {
  if (await copyText(text)) toast(message);
  else toast.error("Couldn't copy to the clipboard.");
}

/** What "Copy value" puts on the clipboard: strings as-is, everything else as JSON. */
export function valueToClipboard(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
}
