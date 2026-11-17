"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import type { ActionState } from "@/lib/validation";

/**
 * Fix a fast's times. Both ends for a finished fast; only the start for the
 * one that's running. A clash with another fast or an end before the start
 * comes back from the server and is shown in the dialog, not in a toast, so
 * you can fix it where you're looking.
 */
export function FastEditDialog({
  title,
  id,
  start,
  end,
  onSave,
  onClose,
}: {
  title: string;
  id: string;
  start: string;
  /** null for the running fast. */
  end: string | null;
  onSave: (formData: FormData) => Promise<ActionState>;
  onClose: () => void;
}) {
  const [startValue, setStartValue] = useState(start);
  const [endValue, setEndValue] = useState(end ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const formData = new FormData();
    formData.set("id", id);
    formData.set("startedAt", startValue);
    if (end !== null) formData.set("endedAt", endValue);
    startTransition(async () => {
      try {
        const state = await onSave(formData);
        if (state.status === "error") {
          setError(Object.values(state.fieldErrors ?? {})[0] ?? state.message);
          return;
        }
        toast.success("Fast updated.");
        onClose();
      } catch {
        setError("Couldn't save that. Try again.");
      }
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-5">
          <DialogHeader>
            <DialogTitle className="font-display">{title}</DialogTitle>
            <DialogDescription>Times are in your timezone.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fast-start">Stopped eating</Label>
              <Input
                id="fast-start"
                type="datetime-local"
                required
                value={startValue}
                onChange={(event) => {
                  setStartValue(event.target.value);
                  setError(null);
                }}
              />
            </div>
            {end !== null && (
              <div className="space-y-1.5">
                <Label htmlFor="fast-end">Broke the fast</Label>
                <Input
                  id="fast-end"
                  type="datetime-local"
                  required
                  value={endValue}
                  onChange={(event) => {
                    setEndValue(event.target.value);
                    setError(null);
                  }}
                />
              </div>
            )}
          </div>

          {error && (
            <p role="alert" className="text-destructive text-label">
              {error}
            </p>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" disabled={pending} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
