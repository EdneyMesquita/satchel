import { toast } from "sonner";
import { useWorkspace } from "./workspace";
import { useSession } from "./session";
import { useUi } from "./ui";
import { parseCurl, CurlParseError } from "@/curl";
import { readClipboardText } from "@/clipboard";
import { paramsFromUrl } from "@/url";

/** Cross-cutting user actions that touch more than one store. */
export function useAppActions() {
  const ws = useWorkspace();
  const session = useSession();
  const ui = useUi();

  function switchEnvironment(environmentId: string) {
    if (environmentId === ws.workspace.activeEnvironmentId) return;
    const env = ws.workspace.environments.find((e) => e.id === environmentId);
    if (!env) return;
    ws.setActiveEnvironment(environmentId);
    session.clearBlocker();
    session.bumpSweep();
    toast(`Switched to ${env.name}. Every {{variable}} was re-resolved.`);
  }

  /** Cycle to the next environment (⌘E). */
  function cycleEnvironment() {
    const envs = ws.workspace.environments;
    if (envs.length === 0) return;
    const i = envs.findIndex((e) => e.id === ws.workspace.activeEnvironmentId);
    switchEnvironment(envs[(i + 1) % envs.length].id);
  }

  function newRequest(collectionId: string | null = null, parentFolderId: string | null = null) {
    const id = ws.addRequest(collectionId, parentFolderId, { url: "{{baseUrl}}/" });
    ui.setForceFirstRun(false);
    session.openTab(id);
    session.requestUrlFocus(id);
    return id;
  }

  function importCurlText(text: string): boolean {
    let parsed;
    try {
      parsed = parseCurl(text);
    } catch (err) {
      toast.error(err instanceof CurlParseError ? err.message : "Couldn't parse that as a curl command.");
      return false;
    }
    const nice = parsed.url.replace(/^https?:\/\/[^/]+/, "").split("?")[0] || "/";
    const id = ws.addRequest(null, null, {
      name: nice.length > 26 ? `${nice.slice(0, 26)}…` : nice,
      method: parsed.method,
      url: parsed.url,
      params: paramsFromUrl(parsed.url, []),
      headers: parsed.headers,
      body: parsed.body,
      auth: parsed.auth,
    });
    ui.setForceFirstRun(false);
    session.openTab(id);
    const parts = [parsed.method, `${parsed.headers.length} header${parsed.headers.length === 1 ? "" : "s"}`];
    if (parsed.body.mode !== "none") parts.push(parsed.body.mode === "raw" ? "JSON body" : "form body");
    toast(`Parsed cURL: ${parts.join(", ")}.`);
    return true;
  }

  async function pasteCurlFromClipboard() {
    let text: string;
    try {
      text = await readClipboardText();
    } catch {
      toast.error("Couldn't read the clipboard. Copy a curl command first, then try again.");
      return;
    }
    importCurlText(text);
  }

  return { switchEnvironment, cycleEnvironment, newRequest, importCurlText, pasteCurlFromClipboard };
}
