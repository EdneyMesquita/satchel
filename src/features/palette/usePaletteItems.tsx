import type { ReactNode } from "react";
import { Download, File, Layers, Moon, Plus, Save, Sparkles, SquareTerminal, Sun, Zap } from "lucide-react";
import { toast } from "sonner";
import type { HttpMethod, SatchelRequest, TreeNode } from "@/types";
import { EnvDot } from "@/components/common/EnvDot";
import { MOD } from "@/components/common/Kbd";
import { useWorkspace } from "@/state/workspace";
import { useSession, ENVIRONMENTS_TAB } from "@/state/session";
import { useUi } from "@/state/ui";
import { useAppActions } from "@/state/actions";
import { useTheme } from "@/state/theme";
import type { Rankable } from "./rank";

export interface PaletteItem extends Rankable {
  /** Unique cmdk value */
  id: string;
  method?: HttpMethod;
  icon?: ReactNode;
  /** send = opened with ⌘↵ */
  run: (send: boolean) => void;
}

function collectRequests(items: TreeNode[], out: SatchelRequest[] = []): SatchelRequest[] {
  for (const node of items) {
    if (node.type === "request") out.push(node.request);
    else collectRequests(node.children, out);
  }
  return out;
}

/** "{{baseUrl}}/v2/products?x=1" → "/v2/products?x=1"; "https://api.dev/health" → "/health" */
export function displayPath(url: string): string {
  const path = url.replace(/^\{\{[^}]+\}\}/, "").replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, "");
  return path || "/";
}

const icon = (Icon: typeof Plus) => <Icon className="size-3.5" strokeWidth={2} />;

/** Every request in the workspace plus the palette's commands, in display order. */
export function usePaletteItems(): PaletteItem[] {
  const ws = useWorkspace();
  const session = useSession();
  const ui = useUi();
  const actions = useAppActions();
  const { theme, toggleTheme } = useTheme();

  const requests: PaletteItem[] = ws.workspace.collections.flatMap((collection) =>
    collectRequests(collection.items).map((request) => ({
      id: `req:${request.id}`,
      group: "Requests" as const,
      label: request.name,
      sub: `${collection.name} · ${displayPath(request.url)}`,
      method: request.method,
      run: (send: boolean) => {
        session.openTab(request.id);
        ui.setSidebarOpen(false);
        if (send) session.send(request.id);
      },
    })),
  );

  const active = session.activeTab;
  const activeRequestId = active && active !== ENVIRONMENTS_TAB && ws.findRequest(active) ? active : null;
  const command = (id: string, label: string, sub: string, ic: ReactNode, run: () => void): PaletteItem => ({
    id: `cmd:${id}`,
    group: "Commands",
    label,
    sub,
    icon: ic,
    run,
  });

  const commands: PaletteItem[] = [
    ...ws.workspace.environments
      .filter((e) => e.id !== ws.workspace.activeEnvironmentId)
      .map((e) => command(`env:${e.id}`, `Switch to ${e.name}`, "environment", <EnvDot color={e.color} />, () => actions.switchEnvironment(e.id))),
    command("new-env", "New environment…", "", icon(Plus), () => ui.openEnvironmentDialog({ mode: "create" })),
    command("postman", "Import Postman collection…", "v2.1", icon(Download), () => ui.openPostmanDialog()),
    command("curl", "Paste cURL from clipboard", "import", icon(SquareTerminal), () => void actions.pasteCurlFromClipboard()),
    command("new-request", "New request", `${MOD}N`, icon(Plus), () => actions.newRequest()),
    command("envs", "Edit environments & globals", "", icon(Layers), () => session.openEnvironments()),
    command("burst", "Burst-test current request", "rate limit", icon(Zap), () => {
      if (activeRequestId) session.setRequestTab(activeRequestId, "rate");
      else toast("Open a request first, then burst-test it.");
    }),
    command("open", "Open workspace file…", ".json", icon(File), () => void ws.openFile()),
    command("save-as", "Save workspace as…", ".json", icon(Save), () => void ws.saveFileAs()),
    command(
      "theme",
      `Switch to ${theme === "dark" ? "light" : "dark"} theme`,
      "",
      icon(theme === "dark" ? Sun : Moon),
      toggleTheme,
    ),
    command("first-run", ui.forceFirstRun ? "Leave first-run" : "Show first-run", "onboarding", icon(Sparkles), () =>
      ui.setForceFirstRun(!ui.forceFirstRun),
    ),
  ];

  return [...requests, ...commands];
}
