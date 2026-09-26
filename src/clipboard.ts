import { readText } from "@tauri-apps/plugin-clipboard-manager";
import { isTauri } from "./platform";

export async function readClipboardText(): Promise<string> {
  if (isTauri()) return readText();
  return navigator.clipboard.readText();
}
