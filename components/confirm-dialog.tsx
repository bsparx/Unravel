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
import { Input } from "@/components/ui/input";

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
 *
 * `confirmPhrase` raises the gate from "yes, I'm sure" to "prove it": when
 * set, the destructive button stays dead until the user types the phrase
 * exactly (whitespace trimmed, case ignored). Reserved for the one-way doors
 * where a mis-tap is not the only risk — wiping a whole feature, not one row.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmPhrase,
  confirmLabel = "Delete for good",
  pendingLabel = "Deleting…",
  cancelLabel = "Keep it",
  onConfirm,
}: {
  /** Renders the button that opens the dialog. */
  trigger: (open: () => void) => ReactNode;
  title: string;
  description: string;
  /** When set, the confirm button unlocks only after this is typed. */
  confirmPhrase?: string;
  confirmLabel?: string;
  pendingLabel?: string;
  cancelLabel?: string;
  onConfirm: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, startTransition] = useTransition();

  const phraseMet =
    !confirmPhrase ||
    typed.trim().toUpperCase() === confirmPhrase.toUpperCase();

  const close = () => {
    setOpen(false);
    setTyped("");
  };

  return (
    <>
      {trigger(() => setOpen(true))}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          if (next) {
            setOpen(true);
          } else {
            close();
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>

          {confirmPhrase && (
            <div className="space-y-1.5">
              <label
                htmlFor="confirm-phrase"
                className="text-muted-foreground text-micro"
              >
                Type <span className="text-foreground font-medium">{confirmPhrase}</span> to confirm
              </label>
              <Input
                id="confirm-phrase"
                autoComplete="off"
                disabled={pending}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder={confirmPhrase}
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              disabled={pending}
              onClick={close}
            >
              {cancelLabel}
            </Button>
            <Button
              variant="destructive"
              disabled={pending || !phraseMet}
              onClick={() =>
                startTransition(async () => {
                  await onConfirm();
                  close();
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
