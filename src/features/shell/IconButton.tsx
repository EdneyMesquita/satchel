import { forwardRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** 28px square ghost icon button (mockup `.icon-btn`). */
export const IconButton = forwardRef<HTMLButtonElement, ComponentProps<"button">>(function IconButton(
  { className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        "grid size-7 flex-none cursor-pointer place-items-center rounded-md text-fg2 hover:bg-bg2 hover:text-fg data-[state=open]:bg-bg2 data-[state=open]:text-fg",
        className,
      )}
      {...props}
    />
  );
});
