import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { Dialog, DialogDescription, DialogOverlay, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import { IconButton } from "@/features/shell/IconButton";

interface ConfirmDeleteDialogProps {
  /** What is being deleted; null keeps the dialog closed */
  target: { kind: "collection" | "folder"; name: string; count: number } | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Small confirm before deleting a collection or folder that still holds requests. */
export function ConfirmDeleteDialog({ target, onCancel, onConfirm }: ConfirmDeleteDialogProps) {
  return (
    <Dialog open={target !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogPortal>
        <DialogOverlay className="bg-[var(--scrim)] animate-fade-in" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 grid w-[min(480px,calc(100vw-32px))] -translate-x-1/2 -translate-y-1/2 animate-fade-in rounded-xl bg-bg1 shadow-pop outline-none">
          {target && (
            <>
              <div className="flex items-center gap-2.5 pt-3.5 pr-3 pb-2.5 pl-[18px]">
                <DialogTitle className="flex-1 text-[15px] font-semibold tracking-[-0.01em]">
                  Delete {target.kind} “{target.name}”?
                </DialogTitle>
                <DialogPrimitive.Close asChild>
                  <IconButton aria-label="Close">
                    <X className="size-2.5" strokeWidth={2.8} />
                  </IconButton>
                </DialogPrimitive.Close>
              </div>
              <DialogDescription className="px-[18px] pt-1 pb-[18px] text-[13px] leading-normal text-fg2">
                It holds {target.count} {target.count === 1 ? "request" : "requests"}. They'll be removed from the workspace file, and this
                can't be undone.
              </DialogDescription>
              <div className="flex items-center gap-2 border-t border-line px-[18px] py-3">
                <span className="flex-1" />
                <DialogPrimitive.Close asChild>
                  <button
                    type="button"
                    className="h-8 cursor-pointer rounded-md border border-line2 px-3.5 font-medium whitespace-nowrap text-fg2 hover:bg-bg2 hover:text-fg"
                  >
                    Cancel
                  </button>
                </DialogPrimitive.Close>
                <button
                  type="button"
                  onClick={onConfirm}
                  className="h-8 cursor-pointer rounded-md bg-err px-3.5 font-medium whitespace-nowrap text-bg1 hover:brightness-110"
                >
                  Delete {target.kind}
                </button>
              </div>
            </>
          )}
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
