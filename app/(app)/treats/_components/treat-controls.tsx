"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Gift, Minus, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  closeChapter,
  createChapter,
  createTreat,
  deleteTreat,
  logObjective,
  toggleTreat,
} from "@/app/(app)/treats/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Option = { id: string; name: string };
const selectClass = "border-input bg-input-surface text-foreground min-h-11 w-full rounded-lg border px-3 text-body";

/** Run an action, toast its error, refresh on success. */
function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<{ ok: true } | { ok: false; message: string }>, success?: string) =>
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (success) toast.success(success);
      router.refresh();
    });
  return { pending, run };
}

export function TreatButtons({ treatId, name, ready, enjoyed }: { treatId: string; name: string; ready: boolean; enjoyed: boolean }) {
  const { pending, run } = useAction();
  return (
    <div className="flex items-center gap-1" aria-busy={pending}>
      {ready && (
        <Button
          type="button"
          size="sm"
          variant={enjoyed ? "secondary" : "default"}
          aria-pressed={enjoyed}
          disabled={pending}
          onClick={() => run(() => toggleTreat(treatId, !enjoyed), enjoyed ? undefined : "Enjoy it. You earned it one small vote at a time.")}
        >
          {enjoyed ? <Check className="size-4" aria-hidden /> : <Gift className="size-4" aria-hidden />}
          {enjoyed ? "Enjoyed" : "Enjoy it"}
        </Button>
      )}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="text-muted-foreground size-11"
        aria-label={`Remove ${name}`}
        disabled={pending}
        onClick={() => run(() => deleteTreat(treatId), "Treat removed.")}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </div>
  );
}

export function AddTreatDialog({ identities }: { identities: Option[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const votesNeeded = Number(form.get("votesNeeded"));
    if (!name) return setError("Name the treat.");
    if (!Number.isInteger(votesNeeded) || votesNeeded < 1 || votesNeeded > 1000) {
      return setError("Choose a whole number of votes from 1 to 1000.");
    }
    setError(null);
    startTransition(async () => {
      const result = await createTreat({ name, identityId: String(form.get("identityId") ?? "") || null, votesNeeded });
      if (!result.ok) return setError(result.message);
      toast.success("Treat added. It unlocks with votes.");
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus className="size-4" aria-hidden />Add treat</Button>
      </DialogTrigger>
      <DialogContent className="rounded-[20px] p-5 sm:max-w-md sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-sans text-xl font-semibold">Add a treat</DialogTitle>
          <DialogDescription>Something to enjoy once the votes are in. Choose one that suits who you&apos;re becoming.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
          <div className="space-y-2">
            <Label htmlFor="treat-name">Treat</Label>
            <Input id="treat-name" name="name" maxLength={80} placeholder="A new sketchbook" className="min-h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="treat-identity">For</Label>
            <select id="treat-identity" name="identityId" className={selectClass} defaultValue="" aria-describedby="treat-identity-help">
              <option value="">The whole cast, this week</option>
              {identities.map((identity) => <option key={identity.id} value={identity.id}>{identity.name}</option>)}
            </select>
            <p id="treat-identity-help" className="text-muted-foreground text-label">
              One identity counts its votes ever. The whole cast counts this week&apos;s and resets each week.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="treat-votes">Votes to unlock</Label>
            <Input id="treat-votes" name="votesNeeded" type="number" min={1} max={1000} defaultValue={20} className="min-h-11 w-32" />
          </div>
          {error && <p role="alert" className="text-destructive text-label">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add treat"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ObjectiveLog({ objectiveId, text, have, target }: { objectiveId: string; text: string; have: number; target: number }) {
  const { pending, run } = useAction();
  return (
    <div className="flex items-center gap-1" aria-busy={pending}>
      <Button type="button" size="icon" variant="ghost" className="size-11" aria-label={`One fewer for ${text}`} disabled={pending || have === 0} onClick={() => run(() => logObjective(objectiveId, -1))}>
        <Minus className="size-4" aria-hidden />
      </Button>
      <Button type="button" size="sm" variant="outline" disabled={pending || have >= target} onClick={() => run(() => logObjective(objectiveId, 1), have + 1 >= target ? "Done. The chapter moves on." : undefined)}>
        <Plus className="size-4" aria-hidden />Log one
      </Button>
    </div>
  );
}

export function CloseChapterButton({ chapterId, complete }: { chapterId: string; complete: boolean }) {
  const { pending, run } = useAction();
  return (
    <Button
      type="button"
      variant={complete ? "default" : "ghost"}
      className={complete ? undefined : "text-muted-foreground"}
      disabled={pending}
      onClick={() => run(() => closeChapter(chapterId), complete ? "Chapter complete. On to the next." : "Chapter set down. It stays in the record.")}
    >
      {complete ? "Close the chapter" : "Set it down"}
    </Button>
  );
}

type Draft = { text: string; target: string; habitId: string };
const blank = (): Draft => ({ text: "", target: "5", habitId: "" });

export function StartChapterDialog({ identities, habits }: { identities: Option[]; habits: { id: string; title: string }[] }) {
  const [open, setOpen] = useState(false);
  const [objectives, setObjectives] = useState<Draft[]>([blank()]);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const update = (index: number, patch: Partial<Draft>) =>
    setObjectives((current) => current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)));

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = String(form.get("title") ?? "").trim();
    const filled = objectives.filter((draft) => draft.text.trim());
    if (!title) return setError("Give the chapter a title.");
    if (filled.length === 0) return setError("Add at least one objective.");
    setError(null);
    startTransition(async () => {
      const result = await createChapter({
        identityId: String(form.get("identityId")),
        title,
        intro: String(form.get("intro") ?? "") || null,
        lengthDays: Number(form.get("lengthDays")),
        reward: String(form.get("reward") ?? "") || null,
        objectives: filled.map((draft) => ({ text: draft.text.trim(), target: Number(draft.target) || 1, habitId: draft.habitId || null })),
      });
      if (!result.ok) return setError(result.message);
      toast.success("Chapter begun. A missed day simply waits.");
      setOpen(false);
      setObjectives([blank()]);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={identities.length === 0}><Plus className="size-4" aria-hidden />Start a chapter</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[20px] p-5 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-sans text-xl font-semibold">Start a chapter</DialogTitle>
          <DialogDescription>A short story for one identity: a few objectives over a few days.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
          <div className="space-y-2">
            <Label htmlFor="chapter-identity">For</Label>
            <select id="chapter-identity" name="identityId" className={selectClass}>
              {identities.map((identity) => <option key={identity.id} value={identity.id}>{identity.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="chapter-title">Title</Label>
            <Input id="chapter-title" name="title" maxLength={80} placeholder="The open notebook" className="min-h-11" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="chapter-intro">The story <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input id="chapter-intro" name="intro" maxLength={300} placeholder="Ten days of making small things, and showing one to someone." className="min-h-11" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="chapter-length">Days</Label>
              <Input id="chapter-length" name="lengthDays" type="number" min={3} max={60} defaultValue={10} className="min-h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chapter-reward">Reward <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input id="chapter-reward" name="reward" maxLength={80} placeholder="A morning at the museum" className="min-h-11" />
            </div>
          </div>
          <fieldset className="space-y-3">
            <legend className="text-label font-medium">Objectives</legend>
            {objectives.map((draft, index) => (
              <div key={index} className="border-border space-y-2 rounded-xl border p-3">
                <Input aria-label={`Objective ${index + 1}`} value={draft.text} onChange={(event) => update(index, { text: event.target.value })} maxLength={120} placeholder="One rough drawing" className="min-h-11" />
                <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                  <Input aria-label={`Times for objective ${index + 1}`} type="number" min={1} max={60} value={draft.target} onChange={(event) => update(index, { target: event.target.value })} className="min-h-11" />
                  <select aria-label={`Counted from for objective ${index + 1}`} value={draft.habitId} onChange={(event) => update(index, { habitId: event.target.value })} className={selectClass}>
                    <option value="">Logged by hand</option>
                    {habits.map((habit) => <option key={habit.id} value={habit.id}>Counts days of {habit.title}</option>)}
                  </select>
                </div>
              </div>
            ))}
            {objectives.length < 5 && (
              <Button type="button" variant="ghost" onClick={() => setObjectives((current) => [...current, blank()])}>
                <Plus className="size-4" aria-hidden />Add objective
              </Button>
            )}
          </fieldset>
          {error && <p role="alert" className="text-destructive text-label">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Begin"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
