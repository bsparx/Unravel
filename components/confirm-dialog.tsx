"use client";

import { useState, useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * One confirmation, in front of anything that destroys data you can't get
 * back.
 *
 * The trigger is a render prop rather than a fixed button, because the buttons
 * that need this look nothing alike — a full-width one at the bottom of an
 * edit form, a small ghost one in a dialog footer — and the thing worth
 * sharing is the confirmation, not the button.
 *
 * Nesting inside another Dialog is fine: Radix stacks the layers and Escape
 * only closes the topmost one.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Delete for good",
  pendingLabel = "Deleting…",
  cancelLabel = "Keep it",
  onConfirm,
}: {
  /** Renders the button that opens the dialog. */
  trigger: (open: () => void) => ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      {trigger(() => setOpen(true))}

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  await onConfirm();
                  setOpen(false);
                })
              }
            >
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
