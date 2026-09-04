"use client";

import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";

import { resetMoneyData } from "../actions";

/**
 * The one-way door at the bottom of the page. It sits in the footer link row
 * with Accounts and Manage categories, tinted destructive so it reads as the
 * dangerous one — and it needs more than a tap to open, because "yes, I'm
 * sure" is not enough friction for wiping every number the user has ever
 * logged. Typing RESET is.
 */
export function ResetBudgetsButton() {
  return (
    <ConfirmDialog
      title="Start from scratch"
      description="Every entry, IOU, transfer, account, envelope and custom category goes. The built-in categories stay. There is no undo."
      confirmPhrase="RESET"
      confirmLabel="Wipe it all"
      pendingLabel="Wiping…"
      cancelLabel="Keep it"
      onConfirm={async () => {
        await resetMoneyData();
        toast.success("Fresh start — everything's gone.");
      }}
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          className="text-destructive/80 hover:text-destructive focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-md text-label transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <RotateCcw className="size-4" aria-hidden />
          Start from scratch
        </button>
      )}
    />
  );
}
