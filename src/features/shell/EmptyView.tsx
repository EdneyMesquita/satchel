import { Kbd, MOD } from "@/components/common/Kbd";

/** Main area when no tab is open. */
export function EmptyView() {
  return (
    <div className="grid h-full place-items-center p-6 text-center text-fg3">
      <div>
        <div className="mb-1.5 text-[13.5px] text-fg2">No request open</div>
        Pick one in the sidebar or press <Kbd>{`${MOD}K`}</Kbd>
      </div>
    </div>
  );
}
