import { useEffect, useRef, type KeyboardEvent } from "react";
import { Plus } from "lucide-react";
import { useWorkspace } from "@/state/workspace";
import { useSession, ENVIRONMENTS_TAB } from "@/state/session";
import { useAppActions } from "@/state/actions";
import { Tab } from "./Tab";

/** 36px strip of open tabs (requests + the Environments tab) with a trailing "+". */
export function TabStrip() {
  const ws = useWorkspace();
  const session = useSession();
  const actions = useAppActions();
  const stripRef = useRef<HTMLDivElement>(null);
  const active = session.activeTab;

  const tabEl = (id: string) => stripRef.current?.querySelector<HTMLElement>(`[data-tab-id="${CSS.escape(id)}"]`);

  useEffect(() => {
    if (active) tabEl(active)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active, session.tabs.length]);

  // ←/→ between tabs when one has focus
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const tabs = session.tabs;
    if (tabs.length === 0) return;
    const i = active ? tabs.indexOf(active) : -1;
    const next = tabs[(i + (e.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
    e.preventDefault();
    session.setActiveTab(next);
    requestAnimationFrame(() => tabEl(next)?.focus());
  };

  return (
    <div ref={stripRef} className="flex items-stretch overflow-x-auto border-b border-line bg-bg0 scrollbar-none">
      <div role="tablist" aria-label="Open tabs" className="flex items-stretch" onKeyDown={onKeyDown}>
        {session.tabs.map((id) => {
          const close = () => session.closeTab(id);
          const select = () => session.setActiveTab(id);
          if (id === ENVIRONMENTS_TAB) {
            return <Tab key={id} id={id} label="Environments" active={id === active} onSelect={select} onClose={close} />;
          }
          const request = ws.findRequest(id)?.request;
          if (!request) return null;
          return (
            <Tab
              key={id}
              id={id}
              label={request.name}
              method={request.method}
              active={id === active}
              onSelect={select}
              onClose={close}
            />
          );
        })}
      </div>
      <button
        type="button"
        title="New request"
        aria-label="New request"
        onClick={() => actions.newRequest()}
        className="grid w-[34px] flex-none cursor-pointer place-items-center text-fg3 hover:text-fg"
      >
        <Plus className="size-[13px]" strokeWidth={2.2} />
      </button>
    </div>
  );
}
