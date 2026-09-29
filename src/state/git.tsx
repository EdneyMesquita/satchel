import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { workspaceFileLabels } from "@/folderFormat";
import { gitCommit, gitCommitMerge, gitFetch, gitInfo, gitInit, gitPull, gitPush, gitStatus, gitVersion, type GitInfo } from "@/git/api";
import { describeChanges, type DescribedChange } from "@/git/describe";
import { commitPaths, parseStatus, type GitStatus } from "@/git/status";
import { errorMessage } from "@/lib/errors";
import { isTauri } from "@/platform";
import { useWorkspace } from "./workspace";

/**
 * Git for the open workspace folder. Everything here is user-initiated
 * (buttons in the source control panel): the app shows what changed and
 * runs commit / pull / push / fetch when asked — never on its own.
 * Status is refreshed in the background, which only reads.
 */

export type GitOperation = "commit" | "pull" | "push" | "fetch" | "init";

interface GitValue {
  /** null while checking; false when git isn't installed (or this isn't the desktop app) */
  available: boolean | null;
  /** why git isn't available */
  unavailableReason: string | null;
  /** null when no folder is open or it hasn't been checked yet */
  repo: GitInfo | null;
  status: GitStatus | null;
  /** status changes in the app's terms, grouped */
  changes: DescribedChange[];
  conflicts: number;
  /** the operation in progress, if any */
  busy: GitOperation | null;
  refreshing: boolean;
  /** the last operation's error, for the panel (background refreshes don't set it) */
  lastError: string | null;
  clearError: () => void;
  /** a merge or rebase in progress, e.g. after a pull that conflicted */
  operation: "merge" | "rebase" | null;
  refresh: () => Promise<void>;
  /**
   * Commit the given workspace-relative paths (and their rename sources).
   * During a merge this completes the merge instead: a merge can't be committed partially.
   */
  commit: (message: string, paths: string[]) => Promise<boolean>;
  pull: () => Promise<boolean>;
  /** Pushes; the first push of a branch sets its upstream on `origin` (or the only remote). */
  push: () => Promise<boolean>;
  fetch: () => Promise<boolean>;
  /** `git init` in the workspace folder */
  init: () => Promise<boolean>;
}

const GitContext = createContext<GitValue | null>(null);
const POLL_MS = 10_000;

/** The first lines of git's output: enough for a toast. */
function brief(text: string, lines = 3): string {
  const all = text.trim().split("\n").filter(Boolean);
  return all.slice(0, lines).join("\n") + (all.length > lines ? "\n…" : "");
}

export function GitProvider({ children }: { children: ReactNode }) {
  const ws = useWorkspace();
  const root = ws.source.kind === "folder" ? ws.source.root : null;
  const [available, setAvailable] = useState<boolean | null>(null);
  const [unavailableReason, setUnavailableReason] = useState<string | null>(null);
  const [repo, setRepo] = useState<GitInfo | null>(null);
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [busy, setBusy] = useState<GitOperation | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const rootRef = useRef(root);
  rootRef.current = root;

  // Is git there at all? (once)
  useEffect(() => {
    if (!isTauri()) {
      setAvailable(false);
      setUnavailableReason("Git needs the desktop app.");
      return;
    }
    gitVersion()
      .then(() => setAvailable(true))
      .catch((err) => {
        setAvailable(false);
        setUnavailableReason(errorMessage(err, "git isn't installed"));
      });
  }, []);

  const refresh = useCallback(async () => {
    const r = rootRef.current;
    if (!r || !available) return;
    if (inflight.current) return inflight.current;
    const run = (async () => {
      setRefreshing(true);
      try {
        const info = await gitInfo(r);
        if (rootRef.current !== r) return;
        setRepo(info);
        setStatus(info.isRepo ? parseStatus(await gitStatus(r), info.prefix) : null);
      } catch {
        // A background refresh failing (e.g. the index is locked by a git command in a terminal)
        // isn't an operation the user ran: keep the last good status and try again on the next tick.
      } finally {
        setRefreshing(false);
        inflight.current = null;
      }
    })();
    inflight.current = run;
    return run;
  }, [available]);

  // A new folder: forget the old repository, read the new one.
  useEffect(() => {
    setRepo(null);
    setStatus(null);
    setLastError(null);
    void refresh();
  }, [root, refresh]);

  // Keep the status fresh: after each save, on focus, and every few seconds while visible.
  useEffect(() => {
    if (ws.saveState === "saved") void refresh();
  }, [ws.saveState, refresh]);
  useEffect(() => {
    if (!root) return;
    const tick = () => document.visibilityState === "visible" && void refresh();
    const id = setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [root, refresh]);

  const labels = useMemo(() => workspaceFileLabels(ws.workspace), [ws.workspace]);
  const changes = useMemo(() => (status ? describeChanges(status.changes, labels) : []), [status, labels]);

  /** Run an operation: one at a time, errors kept for the panel and toasted. */
  const operate = useCallback(
    async (op: GitOperation, run: (root: string) => Promise<string | void>): Promise<boolean> => {
      const r = rootRef.current;
      if (!r || busy) return false;
      setBusy(op);
      setLastError(null);
      try {
        const success = await run(r);
        if (success) toast(success);
        return true;
      } catch (err) {
        const msg = errorMessage(err, `git ${op} failed`);
        setLastError(msg);
        toast.error(brief(msg));
        return false;
      } finally {
        setBusy(null);
        await refresh();
      }
    },
    [busy, refresh],
  );

  const value: GitValue = {
    available,
    unavailableReason,
    repo,
    status,
    changes,
    conflicts: status?.changes.filter((c) => c.kind === "conflicted").length ?? 0,
    busy,
    refreshing,
    lastError,
    clearError: () => setLastError(null),
    operation: repo?.operation ?? null,
    refresh,
    commit: (message, paths) =>
      operate("commit", async (r) => {
        await ws.flush(); // commit what's on screen, not what was on disk 400ms ago
        if (repo?.operation === "rebase") throw new Error("A rebase is in progress. Finish it in a terminal (git rebase --continue or --abort).");
        if (repo?.operation === "merge") {
          await gitCommitMerge(r, message);
          return "Merge completed. Push when you're ready to share it.";
        }
        const selected = status?.changes.filter((c) => paths.includes(c.path)) ?? [];
        const all = commitPaths(selected.length ? selected : paths.map((path) => ({ path, kind: "modified", index: ".", worktree: "M" })));
        await gitCommit(r, message, all);
        return `Committed ${paths.length} file${paths.length === 1 ? "" : "s"}. Push when you're ready to share it.`;
      }),
    pull: () =>
      operate("pull", async (r) => {
        await ws.flush();
        const out = await gitPull(r);
        await ws.reloadFromDisk(); // the watcher would too; don't wait for it
        const text = `${out.stdout}\n${out.stderr}`;
        return /Already up to date/i.test(text) ? "Already up to date." : "Pulled. The workspace was reloaded.";
      }),
    push: () =>
      operate("push", async (r) => {
        const upstream = status?.upstream;
        if (upstream) {
          await gitPush(r);
          return `Pushed to ${upstream}.`;
        }
        const remotes = repo?.remotes ?? [];
        const remote = remotes.includes("origin") ? "origin" : remotes[0];
        if (!remote) throw new Error("This repository has no remote yet. Add one (git remote add origin <url>), then push.");
        await gitPush(r, remote);
        return `Published ${status?.branch ?? "the branch"} to ${remote}.`;
      }),
    fetch: () =>
      operate("fetch", async (r) => {
        await gitFetch(r);
      }),
    init: () =>
      operate("init", async (r) => {
        await gitInit(r);
        return "Initialized a git repository. Commit the workspace to start sharing it.";
      }),
  };

  return <GitContext.Provider value={value}>{children}</GitContext.Provider>;
}

export function useGit(): GitValue {
  const ctx = useContext(GitContext);
  if (!ctx) throw new Error("useGit must be used inside <GitProvider>");
  return ctx;
}
