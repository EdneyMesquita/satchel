import { forwardRef, type ComponentProps, type ReactNode } from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { Dialog, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { IconButton } from "@/features/shell/IconButton";
import { cn } from "@/lib/utils";

/**
 * The mockup's `.modal` on top of shadcn's Dialog: 640px (480px small),
 * bg1 surface, pop shadow, header / scrollable body / bordered footer.
 */

interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  size?: "md" | "sm";
  children: ReactNode;
  /** Where focus goes on open (default: Radix's first focusable) */
  onOpenAutoFocus?: (event: Event) => void;
  onKeyDown?: ComponentProps<"div">["onKeyDown"];
  className?: string;
}

export function Modal({ title, onClose, size = "md", children, onOpenAutoFocus, onKeyDown, className }: ModalProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay className="z-[70] animate-fade-in bg-[var(--scrim)]" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={onOpenAutoFocus}
          onKeyDown={onKeyDown}
          className={cn(
            "fixed top-1/2 left-1/2 z-[72] grid max-h-[calc(100vh-64px)] -translate-x-1/2 -translate-y-1/2 grid-rows-[auto_minmax(0,1fr)_auto] rounded-xl bg-bg1 text-[13px] text-fg shadow-pop outline-none animate-fade-in",
            size === "sm" ? "w-[min(480px,calc(100vw-32px))]" : "w-[min(640px,calc(100vw-32px))]",
            className,
          )}
        >
          <div className="flex items-center gap-2.5 pt-3.5 pr-3 pb-2.5 pl-[18px]">
            <DialogTitle className="m-0 flex-1 text-[15px] leading-[1.4] font-semibold tracking-[-0.01em]">{title}</DialogTitle>
            <IconButton aria-label="Close" onClick={onClose}>
              <X className="size-2.5" strokeWidth={2.4} />
            </IconButton>
          </div>
          {children}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}

export function ModalBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("grid min-h-0 content-start gap-4 overflow-x-hidden overflow-y-auto px-[18px] pt-1 pb-[18px]", className)}
      {...props}
    />
  );
}

export function ModalFooter({ hint, children }: { hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 border-t border-line px-[18px] py-3">
      {hint && <span className="min-w-0 text-xs leading-[1.5] text-fg3">{hint}</span>}
      <span className="flex-1" />
      {children}
    </div>
  );
}

export function Field({ label, htmlFor, children, className }: { label: ReactNode; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-xs text-fg3">
        {label}
      </label>
      {children}
    </div>
  );
}

export function Hint({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("text-xs leading-[1.5] text-fg3", className)} {...props} />;
}

export function FieldError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <div role="alert" className="text-xs text-err">
      {children}
    </div>
  );
}

/** Mockup `.input`: 32px, line2 border, bg0, brass focus border. */
export const INPUT_CLASS =
  "block h-8 w-full min-w-0 rounded-md border border-line2 bg-bg0 px-2.5 text-[13px] leading-[30px] text-fg outline-none placeholder:text-fg3 focus:border-brass-line";

export const TextInput = forwardRef<HTMLInputElement, ComponentProps<"input">>(function TextInput({ className, ...props }, ref) {
  return <input ref={ref} autoComplete="off" spellCheck={false} className={cn(INPUT_CLASS, className)} {...props} />;
});

type ButtonProps = ComponentProps<"button">;

export function PrimaryButton({ className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "h-8 cursor-pointer rounded-md bg-fg px-3.5 font-medium whitespace-nowrap text-bg1 hover:brightness-[1.12] disabled:cursor-default disabled:opacity-35 disabled:hover:brightness-100",
        className,
      )}
      {...props}
    />
  );
}

export function SecondaryButton({ className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "h-8 cursor-pointer rounded-md border border-line2 px-3.5 font-medium whitespace-nowrap text-fg2 hover:bg-bg2 hover:text-fg",
        className,
      )}
      {...props}
    />
  );
}

/** Mockup `.linkbtn`: underlined text button. */
export function LinkButton({ className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "cursor-pointer text-fg2 underline decoration-line2 underline-offset-[3px] hover:text-fg hover:decoration-current",
        className,
      )}
      {...props}
    />
  );
}

/** shadcn Select restyled as the mockup's `select.input`. */
export const SELECT_TRIGGER_CLASS =
  "h-8 w-full rounded-md border-line2 bg-bg0 px-2.5 py-0 text-[13px] text-fg shadow-none hover:bg-bg0 focus-visible:border-brass-line focus-visible:ring-0 data-[size=default]:h-8 dark:bg-bg0 dark:hover:bg-bg0 [&_svg:not([class*='text-'])]:text-fg3";
export const SELECT_CONTENT_CLASS = "rounded-lg border-0 bg-bg1 p-0 text-fg shadow-pop";
export const SELECT_ITEM_CLASS = "h-7 rounded-[5px] py-0 text-[13px] text-fg2 focus:bg-bg3 focus:text-fg";
