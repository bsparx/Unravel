"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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

/**
 * Add or edit one identity: its name, its statement, its characteristics, and
 * the habits that vote for it. Mounted fresh for each open (the board keys it),
 * so every field can stay uncontrolled and the habit chips only need the
 * selection in state.
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
  const [nameError, setNameError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // If creation succeeded but linking failed, retry the same identity.
  const [createdIdentityId, setCreatedIdentityId] = useState<string | null>(null);

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
    const characteristics = String(form.get("characteristics") ?? "").trim();
    setNameError(null);
    setSaveError(null);

    if (!name) {
      setNameError("Give this identity a name, such as Writer.");
      return;
    }

    startTransition(async () => {
      try {
        let identityId = identity?.id ?? createdIdentityId;

        if (identityId) {
          const result = await updateIdentity({
            id: identityId,
            name,
            statement: statement || null,
            characteristics: characteristics || null,
          });
          if (!result.ok) {
            setSaveError(result.message);
            return;
          }
        } else {
          const result = await createIdentity(
            name,
            statement || null,
            characteristics || null,
          );
          if (!result.ok) {
            setSaveError(result.message);
            return;
          }
          identityId = result.identity.id;
          setCreatedIdentityId(identityId);
        }

        // The links are the second half of the same thought. Set semantics: the
        // chips are the whole answer.
        const links = await setIdentityHabits(identityId!, selected);
        if (!links.ok) {
          setSaveError(links.message);
          return;
        }

        toast.success(identity ? `Saved "${name}".` : `"${name}" added.`);
        onOpenChange(false);
      } catch {
        setSaveError("Could not save this identity. Your draft is still here. Try again.");
      }
    });
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!pending) onOpenChange(open); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[20px] p-5 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-sans text-xl font-semibold">
            {identity ? identity.name : "Add identity"}
          </DialogTitle>
          <DialogDescription>
            Link habits that help you practise this identity. Keeping a
            habit&apos;s minimum counts as a vote.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
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
              className="min-h-11"
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "identity-name-error" : undefined}
              disabled={pending}
            />
            {nameError && <p id="identity-name-error" role="alert" className="text-destructive text-label">{nameError}</p>}
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
              className="min-h-11"
              aria-describedby="identity-statement-help"
              disabled={pending}
            />
            <p id="identity-statement-help" className="text-muted-foreground text-label">
              A sentence that describes the person you want to become.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="identity-characteristics" className="text-label font-medium">
              Characteristics of this identity
            </Label>
            <Textarea
              id="identity-characteristics"
              name="characteristics"
              rows={5}
              maxLength={5000}
              defaultValue={identity?.characteristics ?? ""}
              placeholder="The choices and qualities you want to practise."
              className="resize-none text-body"
              aria-describedby="identity-characteristics-help"
              disabled={pending}
            />
            <p id="identity-characteristics-help" className="text-muted-foreground text-label">
              Optional. Add details that make this identity useful to you.
            </p>
          </div>

          <fieldset className="space-y-2" disabled={pending}>
            <legend className="text-label font-medium">
              Which habits vote for it?
            </legend>
            <div className="flex flex-wrap gap-2">
              {habits.map((habit) => {
                const on = selected.includes(habit.id);
                return (
                  <Button
                    key={habit.id}
                    type="button"
                    onClick={() => toggle(habit.id)}
                    aria-pressed={on}
                    variant={on ? "default" : "outline"}
                    className="h-auto min-h-11 max-w-full py-2 text-left text-label whitespace-normal"
                  >
                    {habit.title}
                    {habit.archived && <span className="text-xs">(archived)</span>}
                  </Button>
                );
              })}
              {habits.length === 0 && (
                <div className="space-y-2">
                  <p className="text-muted-foreground text-label">No habits yet. You can link one later.</p>
                  <Button variant="outline" asChild><Link href="/habits/new">Add habit</Link></Button>
                </div>
              )}
            </div>
          </fieldset>

          {saveError && <p role="alert" className="text-destructive text-label">{saveError}</p>}

          <div className="border-border flex items-center justify-between gap-3 border-t pt-4">
            {identity ? (
              <ConfirmDialog
                trigger={(openDialog) => (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={openDialog}
                    disabled={pending}
                  >
                    <Trash2 className="size-4" aria-hidden />
                    Delete
                  </Button>
                )}
                title={`Delete "${identity.name}"?`}
                description="Your habits and their history stay. This identity and its links are removed, so its vote tally is no longer shown."
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
                disabled={pending}
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
