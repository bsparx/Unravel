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
import { IdentitySigil } from "@/components/identity-sigil";
import {
  ARCHETYPES,
  ARCHETYPE_NAMES,
  ARCHETYPE_SIGIL,
  IDENTITY_HUES,
  SIGILS,
  SIGIL_NAMES,
  isArchetype,
  nextFreeSlot,
  type Sigil,
} from "@/lib/identity-look";
import { cn } from "@/lib/utils";

import type { BoardIdentity } from "./types";

/**
 * Add or edit one identity: its name, its statement, its characteristics, and
 * the habits that vote for it. Mounted fresh for each open (the board keys it),
 * so every field can stay uncontrolled and the habit chips only need the
 * selection in state.
 */
export function IdentityDialog({
  identity,
  habits,
  usedSlots,
  preselectHabitId,
  onOpenChange,
}: {
  /** Null for a new identity. */
  identity: BoardIdentity | null;
  habits: { id: string; title: string; archived: boolean }[];
  /** Colours other identities hold, so a new one starts on a free hue. */
  usedSlots: number[];
  preselectHabitId?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const [selected, setSelected] = useState<string[]>(
    identity
      ? identity.linked.map((habit) => habit.habitId)
      : preselectHabitId
        ? [preselectHabitId]
        : [],
  );
  const [archetype, setArchetype] = useState<string>(identity?.archetype ?? "");
  const [slot, setSlot] = useState<number>(identity?.colorSlot ?? nextFreeSlot(usedSlots));
  // Untouched, the sigil follows the archetype; once picked, it stays.
  const [sigil, setSigil] = useState<Sigil | null>(identity ? identity.sigil : null);
  const shownSigil: Sigil = sigil ?? (isArchetype(archetype) ? ARCHETYPE_SIGIL[archetype] : "sprout");
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
    const question = String(form.get("question") ?? "").trim();
    const kindValue = String(form.get("kind") ?? "");
    const profile = {
      kind: kindValue === "REAL" || kindValue === "FICTIONAL" ? kindValue : null,
      archetype: isArchetype(archetype) ? archetype : null,
      question: question || null,
      colorSlot: slot,
      sigil: shownSigil,
    } as const;
    setNameError(null);
    setSaveError(null);

    if (!name) {
      setNameError("Give this identity a name, like a character you admire.");
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
            ...profile,
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
            profile,
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
            Borrow someone you admire, real or fictional. Keeping a linked
            habit&apos;s minimum counts as a vote for them.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
          <div className="space-y-2">
            <Label htmlFor="identity-name" className="text-label font-medium">
              Character
            </Label>
            <Input
              id="identity-name"
              name="name"
              required
              maxLength={40}
              defaultValue={identity?.name ?? ""}
              placeholder="Ada Lovelace, or Writer"
              className="min-h-11"
              aria-invalid={!!nameError}
              aria-describedby={nameError ? "identity-name-error" : undefined}
              disabled={pending}
            />
            {nameError && <p id="identity-name-error" role="alert" className="text-destructive text-label">{nameError}</p>}
          </div>

          <fieldset className="space-y-2" disabled={pending}>
            <legend className="text-label font-medium">This character is</legend>
            <div className="flex flex-wrap gap-2">
              {([["REAL", "Real"], ["FICTIONAL", "Fictional"], ["", "Just a role"]] as const).map(([value, label]) => (
                <label
                  key={label}
                  className="border-input bg-input-surface has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-ring relative inline-flex min-h-11 cursor-pointer items-center rounded-lg border px-3 text-label has-[:checked]:font-semibold has-[:focus-visible]:ring-2"
                >
                  <input
                    type="radio"
                    name="kind"
                    value={value}
                    defaultChecked={(identity?.kind ?? "") === value}
                    className="absolute inset-0 cursor-pointer opacity-0"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="identity-archetype" className="text-label font-medium">
              Archetype
            </Label>
            <select
              id="identity-archetype"
              value={archetype}
              onChange={(event) => setArchetype(event.target.value)}
              aria-describedby="identity-archetype-help"
              disabled={pending}
              className="border-input bg-input-surface text-foreground min-h-11 w-full rounded-lg border px-3 text-body"
            >
              <option value="">None</option>
              {ARCHETYPE_NAMES.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <p id="identity-archetype-help" className="text-muted-foreground text-label">
              {isArchetype(archetype)
                ? ARCHETYPES[archetype]
                : "Optional. Jung's patterns of character, as a prompt for reflection."}
            </p>
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
            <Label htmlFor="identity-question" className="text-label font-medium">
              Their question
            </Label>
            <Input
              id="identity-question"
              name="question"
              maxLength={140}
              defaultValue={identity?.question ?? ""}
              placeholder="What am I not noticing yet?"
              className="min-h-11"
              aria-describedby="identity-question-help"
              disabled={pending}
            />
            <p id="identity-question-help" className="text-muted-foreground text-label">
              Optional. One question this self asks before starting. It appears on the timer.
            </p>
          </div>

          <fieldset className="space-y-2" disabled={pending}>
            <legend className="text-label font-medium">Color and sigil</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
              {IDENTITY_HUES.map((hue, index) => {
                const value = index + 1;
                const taken = usedSlots.includes(value) && value !== identity?.colorSlot;
                return (
                  <button
                    key={hue}
                    type="button"
                    role="radio"
                    aria-checked={slot === value}
                    aria-label={`${hue}${taken ? ", used by another identity" : ""}`}
                    onClick={() => setSlot(value)}
                    className={cn(
                      "border-input bg-input-surface focus-visible:ring-ring grid size-11 place-items-center rounded-lg border focus-visible:ring-2 focus-visible:outline-none",
                      slot === value && "border-ring ring-ring ring-2",
                    )}
                  >
                    <span
                      aria-hidden
                      className="size-6 rounded-md"
                      style={{ background: `var(--id-${value})` }}
                    />
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Sigil">
              {SIGIL_NAMES.map((name) => (
                <button
                  key={name}
                  type="button"
                  role="radio"
                  aria-checked={shownSigil === name}
                  aria-label={SIGILS[name]}
                  onClick={() => setSigil(name)}
                  className={cn(
                    "focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:outline-none",
                    shownSigil === name && "ring-ring ring-2",
                  )}
                >
                  <IdentitySigil sigil={name} slot={slot} />
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="identity-characteristics" className="text-label font-medium">
              How they move
            </Label>
            <Textarea
              id="identity-characteristics"
              name="characteristics"
              rows={5}
              maxLength={5000}
              defaultValue={identity?.characteristics ?? ""}
              placeholder="Looks before concluding. Keeps a notebook. Comes back to unfinished work."
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
