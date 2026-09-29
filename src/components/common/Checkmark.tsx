import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface CheckmarkProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

/** 14px brass checkbox used in key/value tables and option rows. */
export function Checkmark({ checked, onChange, label, className }: CheckmarkProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "grid size-3.5 shrink-0 place-items-center rounded-[3px] border border-line2",
        checked && "border-brass bg-brass text-brass-ink",
        className,
      )}
    >
      {checked && <Check className="size-2.5" strokeWidth={3.5} />}
    </button>
  );
}
