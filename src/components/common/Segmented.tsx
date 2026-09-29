import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string }[];
  className?: string;
  /** "sm": 20px items, for dense toolbars */
  size?: "md" | "sm";
  "aria-label"?: string;
}

/** The small pill-in-a-track switch used for body type, auth type, "Add to", etc. */
export function Segmented<T extends string>({ value, onChange, options, className, size = "md", ...rest }: SegmentedProps<T>) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={rest["aria-label"]}
      className={cn(
        "inline-flex w-max max-w-full gap-0 overflow-x-auto rounded-md border border-line bg-bg0 p-0.5 shadow-none scrollbar-none",
        className,
      )}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className={cn(
            "h-6 min-w-0 flex-none rounded-sm border-0 px-2.5 text-xs font-normal whitespace-nowrap text-fg3 shadow-none hover:bg-transparent hover:text-fg data-[state=on]:bg-bg3 data-[state=on]:text-fg",
            size === "sm" && "h-5 px-2 text-[11.5px]",
          )}
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
