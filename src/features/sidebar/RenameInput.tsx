import { useEffect, useRef, useState } from "react";

interface RenameInputProps {
  initial: string;
  /** Called once: the trimmed new name, or null to cancel */
  onDone: (name: string | null) => void;
}

/** Inline rename field inside a tree row. Enter commits, Esc cancels, blur commits. */
export function RenameInput({ initial, onDone }: RenameInputProps) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    // After a menu closes focus may still be settling; select on the next frame.
    const id = requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  const finish = (name: string | null) => {
    if (done.current) return;
    done.current = true;
    const trimmed = name?.trim();
    onDone(trimmed && trimmed !== initial ? trimmed : null);
  };

  return (
    <input
      ref={ref}
      value={value}
      aria-label="Name"
      spellCheck={false}
      autoComplete="off"
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          finish(value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          finish(null);
        }
      }}
      onBlur={() => finish(value)}
      className="h-[22px] min-w-0 flex-1 rounded-sm border border-brass-line bg-bg0 px-1.5 text-[13px] text-fg outline-none"
    />
  );
}
