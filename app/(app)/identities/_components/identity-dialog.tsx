"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  createIdentity,
  deleteIdentity,
  setIdentityHabits,
  updateIdentity,
} from "@/app/(app)/identities/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { IdentityReinforcement } from "@/lib/identity-reinforcement";
import { cn } from "@/lib/utils";

/**
 * Add or edit one identity: its name, its statement, and the habits that vote
 * for it. Mounted fresh for each open (the board keys it), so every field can
 * stay uncontrolled and the habit chips only need the selection in state.
 */
export function IdentityDialog({
  identity,
  habits,
  onOpenChange,
}: {
  /** Null for a new identity. */
  identity: IdentityReinforcement | null;
  habits: { id: string; title: string; archived: boolean }[];
  onOpenChange: (open: boolean) => void;
}) {
  const [selected, setSelected] = useState<string[]>(
    identity ? identity.linked.map((habit) => habit.habitId) : [],
  );
  const [pending, startTransition] = useTransition();

  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const statement = String(form.get("statement") ?? "").trim();
    const note = String(form.get("note") ?? "").trim();

    if (!name) {
      toast.error("Name it — the noun, like \"Writer\".");
      return;
    }

    startTransition(async () => {
      let identityId = identity?.id ?? null;

      if (identity) {
        const result = await updateIdentity({
          id: identity.id,
          name,
          statement: statement || null,
          note: note || null,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
      } else {
        const result = await createIdentity(name, statement || null, note || null);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        identityId = result.identity.id;
      }

      // The links are the second half of the same thought. Set semantics: the
      // chips are the whole answer.
      const links = await setIdentityHabits(identityId!, selected);
      if (!links.ok) {
        toast.error(links.message);
        return;
      }

      toast.success(identity ? `Saved "${name}".` : `"${name}" added.`);
      onOpenChange(false);
    });
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display">
            {identity ? identity.name : "Add identity"}
          </DialogTitle>
          <DialogDescription>
            Who you are becoming. The habits you link are the evidence — every
            one you keep casts a vote for this.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identity-name" className="text-label font-medium">
              Name
            </Label>
            <Input
              id="identity-name"
              name="name"
              required
              maxLength={24}
              defaultValue={identity?.name ?? ""}
              placeholder="Writer"
              className="h-9"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="identity-statement" className="text-label font-medium">
              Statement
            </Label>
            <Input
              id="identity-statement"
              name="statement"
              maxLength={200}
              defaultValue={identity?.statement ?? ""}
              placeholder="I am someone who writes every day."
              className="h-9"
            />
            <p className="text-muted-foreground text-micro">
              The sentence the habits are evidence for. The tally reads it back
              at you.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="identity-note" className="text-label font-medium">
              Why it matters
            </Label>
            <Textarea
              id="identity-note"
              name="note"
              rows={2}
              maxLength={500}
              defaultValue={identity?.note ?? ""}
              placeholder="Optional, and fine empty."
            />
          </div>

          <div className="space-y-2">
            <Label className="text-label font-medium">
              Which habits vote for it?
            </Label>
            <div className="flex flex-wrap gap-1.5">
              {habits.map((habit) => {
                const on = selected.includes(habit.id);
                return (
                  <button
                    key={habit.id}
                    type="button"
                    onClick={() => toggle(habit.id)}
                    aria-pressed={on}
                    className={cn(
                      "border-border text-label focus-visible:ring-ring inline-flex h-7 items-center rounded-full border px-2.5 transition-colors focus-visible:ring-2 focus-visible:outline-none",
                      on
                        ? "bg-primary text-primary-foreground border-transparent"
                        : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                      habit.archived && "opacity-60",
                    )}
                  >
                    {habit.title}
                  </button>
                );
              })}
              {habits.length === 0 && (
                <p className="text-muted-foreground text-label">
                  No habits yet — add one on /habits first.
                </p>
              )}
            </div>
          </div>

          <div className="border-border flex items-center justify-between gap-3 border-t pt-4">
            {identity ? (
              <ConfirmDialog
                trigger={(openDialog) => (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={openDialog}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Delete
                  </Button>
                )}
                title={`Delete "${identity.name}"?`}
                description="The habits and their history stand — they just stop counting for this one. Since the tally reads your links as they are today, its votes leave with it."
                confirmLabel="Delete identity"
                onConfirm={async () => {
                  const result = await deleteIdentity(identity.id);
                  if (!result.ok) {
                    toast.error(result.message);
                    return;
                  }
                  toast.success(`Deleted "${identity.name}".`);
                  onOpenChange(false);
                }}
              />
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : identity ? "Save identity" : "Add identity"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}