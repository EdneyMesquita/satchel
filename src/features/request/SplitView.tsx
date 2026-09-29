import { useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

const KEY = "satchel.split";
const MIN = 25;
const MAX = 75;

function loadSplit(): number {
  try {
    const n = Number(localStorage.getItem(KEY));
    if (n >= MIN && n <= MAX) return n;
  } catch {
    // ignore
  }
  return 50;
}

// Shared across request views (each tab remounts its view), and kept across restarts.
let remembered: number | null = null;

/** Request | 1px draggable gutter (25–75%) | response. Stacks vertically at ≤820px. */
export function SplitView({ left, right }: { left: ReactNode; right: ReactNode }) {
  const [split, setSplit] = useState(() => (remembered ??= loadSplit()));
  const [dragging, setDragging] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const onMouseDown = (e: ReactMouseEvent) => {
    if (e.button !== 0 || window.innerWidth <= 820 || !ref.current) return;
    e.preventDefault();
    const rect = ref.current.getBoundingClientRect();
    setDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    let last = split;
    const move = (ev: MouseEvent) => {
      last = Math.min(MAX, Math.max(MIN, ((ev.clientX - rect.left) / rect.width) * 100));
      setSplit(last);
    };
    const up = () => {
      setDragging(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      remembered = last;
      try {
        localStorage.setItem(KEY, String(Math.round(last * 10) / 10));
      } catch {
        // ignore
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div
      ref={ref}
      style={{ "--split": `${split}%` } as CSSProperties}
      className="grid min-h-0 min-w-0 grid-cols-[var(--split)_1px_minmax(0,1fr)] max-[820px]:grid-cols-1 max-[820px]:grid-rows-[minmax(240px,1fr)_1px_1fr]"
    >
      {left}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-valuenow={Math.round(split)}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        onMouseDown={onMouseDown}
        className={cn(
          "relative cursor-col-resize bg-line after:absolute after:inset-y-0 after:-inset-x-1 after:content-[''] hover:bg-brass-line max-[820px]:cursor-default",
          dragging && "bg-brass-line",
        )}
      />
      {right}
    </div>
  );
}
