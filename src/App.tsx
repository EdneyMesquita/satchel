import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/state/theme";
import { WorkspaceProvider, useWorkspace } from "@/state/workspace";
import { SessionProvider, useSession, ENVIRONMENTS_TAB } from "@/state/session";
import { UiProvider, useUi } from "@/state/ui";
import { GitProvider } from "@/state/git";
import { AppHeader } from "@/features/shell/AppHeader";
import { AppFooter } from "@/features/shell/AppFooter";
import { useGlobalShortcuts } from "@/features/shell/useGlobalShortcuts";
import { Sidebar } from "@/features/sidebar/Sidebar";
import { TabStrip } from "@/features/tabs/TabStrip";
import { CommandPalette } from "@/features/palette/CommandPalette";
import { FirstRun } from "@/features/onboarding/FirstRun";
import { RequestView } from "@/features/request/RequestView";
import { EnvironmentMatrix } from "@/features/environments/EnvironmentMatrix";
import { EnvironmentDialog } from "@/features/environments/EnvironmentDialog";
import { PostmanImportDialog } from "@/features/import/PostmanImportDialog";
import { DropImportOverlay } from "@/features/import/DropImportOverlay";
import { EmptyView } from "@/features/shell/EmptyView";
import { FolderSetupDialog } from "@/features/workspace/FolderSetupDialog";
import { cn } from "@/lib/utils";

export default function App() {
  return (
    <ThemeProvider>
      <WorkspaceProvider>
        <SessionProvider>
          <UiProvider>
            <GitProvider>
              <TooltipProvider delayDuration={300}>
                <Shell />
                <Toaster
                  position="bottom-right"
                  offset={{ bottom: 36, right: 14 }}
                  toastOptions={{
                    unstyled: true,
                    classNames: {
                      // The mockup's toast: compact card, brass dot, optional underlined action.
                      toast:
                        "flex w-full max-w-[420px] items-center gap-2.5 rounded-lg bg-bg1 px-3 py-[9px] text-[12.5px] text-fg shadow-pop before:size-1.5 before:flex-none before:rounded-full before:bg-brass data-[type=error]:before:bg-err",
                      icon: "hidden",
                      actionButton: "ml-auto font-medium text-fg underline underline-offset-3",
                      cancelButton: "text-fg3",
                    },
                  }}
                />
              </TooltipProvider>
            </GitProvider>
          </UiProvider>
        </SessionProvider>
      </WorkspaceProvider>
    </ThemeProvider>
  );
}

function Shell() {
  const ws = useWorkspace();
  const session = useSession();
  const ui = useUi();
  useGlobalShortcuts();

  const isEmpty = ws.workspace.collections.length === 0;
  const showFirstRun = ui.forceFirstRun || (isEmpty && session.tabs.length === 0);
  const active = session.activeTab;

  return (
    <div className="grid h-screen grid-rows-[44px_minmax(0,1fr)_24px]">
      <AppHeader />
      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)] min-[820px]:grid-cols-[256px_minmax(0,1fr)]">
        <Sidebar />
        <main className={cn("grid min-h-0 min-w-0 bg-bg1", !showFirstRun && "grid-rows-[36px_minmax(0,1fr)]")}>
          {showFirstRun ? (
            <FirstRun />
          ) : (
            <>
              <TabStrip />
              <div className="grid min-h-0 min-w-0">
                {active === ENVIRONMENTS_TAB ? (
                  <EnvironmentMatrix />
                ) : active && ws.findRequest(active) ? (
                  <RequestView key={active} requestId={active} />
                ) : (
                  <EmptyView />
                )}
              </div>
            </>
          )}
        </main>
      </div>
      <AppFooter />

      <CommandPalette />
      <EnvironmentDialog />
      <PostmanImportDialog />
      <DropImportOverlay />
      <FolderSetupDialog />
    </div>
  );
}
