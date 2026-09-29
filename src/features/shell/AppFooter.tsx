import { File } from "lucide-react";
import { version } from "../../../package.json";
import { useWorkspace } from "@/state/workspace";

/** 24px status footer: workspace path, active environment, version. */
export function AppFooter() {
  const ws = useWorkspace();
  const env = ws.activeEnvironment;
  const count = env?.variables.length ?? 0;

  return (
    <footer className="flex items-center gap-3.5 overflow-hidden border-t border-line px-2.5 text-[11.5px] whitespace-nowrap text-fg3">
      <File className="size-3.5 shrink-0" strokeWidth={1.8} aria-hidden />
      <span className="min-w-0 truncate font-mono text-fg2" title={ws.filePath ?? undefined}>
        {ws.filePath ?? "No file yet · kept in app cache"}
      </span>
      {env && (
        <span className="max-[820px]:hidden">
          · {env.name} · {count} environment {count === 1 ? "variable" : "variables"}
        </span>
      )}
      <span className="flex-1" />
      <span className="max-[820px]:hidden">Satchel {version}</span>
    </footer>
  );
}
