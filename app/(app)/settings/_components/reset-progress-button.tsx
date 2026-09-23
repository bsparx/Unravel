"use client";

import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/confirm-dialog";

import { resetAllProgress } from "../actions";

/**
 * The one-way door in the settings danger zone. Typing RESET is the gate —
 * "yes, I'm sure" is not enough friction for wiping every logged day and
 * every minute on the clock.
 */
export function ResetProgressButton() {
  return (
    <ConfirmDialog
      title="Reset all progress?"
      description="Deletes every logged day and every focus session. Missed days, streaks, identity votes and feedback notes go to zero. Habits, identities, schedules and quotas stay. There is no undo."
      confirmPhrase="RESET"
      confirmLabel="Wipe progress"
      pendingLabel="Wiping…"
      cancelLabel="Keep it"
      onConfirm={async () => {
        const result = await resetAllProgress();
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success("Progress wiped — habits and identities are untouched.");
      }}
      trigger={(open) => (
        <Button type="button" variant="destructive" onClick={open}>
          <RotateCcw className="size-4" aria-hidden />
          Reset all progress
        </Button>
      )}
    />
  );
}
