"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Eye, Plus } from "lucide-react";
import { toast } from "sonner";

import {
  archiveShadowPattern,
  createShadowPattern,
  markShadow,
} from "@/app/(app)/habits/shadow-actions";
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
import { SHADOW_LAWS } from "@/lib/identity-look";

type Mark = "NOTICED" | "CHOSE" | null;

/**
 * Today's two buttons on a shadow card. Pressing the active one clears it.
 * Optimistic, so the mark lands before the round trip does.
 */
export function ShadowMarkButtons({
  patternId,
  today,
  against,
}: {
  patternId: string;
  today: Mark;
  /** The identity choosing otherwise votes for, for the toast. */
  against: string | null;
}) {
  const router = useRouter();
  const [mark, setMark] = useOptimistic<Mark>(today);
  const [pending, startTransition] = useTransition();

  const press = (next: "NOTICED" | "CHOSE") =>
    startTransition(async () => {
      const value = mark === next ? null : next;
      setMark(value);
      const result = await markShadow(patternId, value);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (value === "CHOSE") toast.success(against ? `Chose otherwise. That's a vote for ${against}.` : "Chose otherwise.");
      else if (value === "NOTICED") toast("Noticed. That's useful to know, nothing more.");
      router.refresh();
    });

  return (
    <div className="flex flex-wrap gap-2" aria-busy={pending}>
      <Button type="button" variant={mark === "NOTICED" ? "secondary" : "outline"} aria-pressed={mark === "NOTICED"} onClick={() => press("NOTICED")}>
        <Eye className="size-4" aria-hidden />
        Noticed it
      </Button>
      <Button type="button" variant={mark === "CHOSE" ? "secondary" : "outline"} aria-pressed={mark === "CHOSE"} onClick={() => press("CHOSE")}>
        <Check className="size-4" aria-hidden />
        Chose otherwise
      </Button>
    </div>
  );
}

export function LetGoButton({ patternId, name }: { patternId: string; name: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="text-muted-foreground"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await archiveShadowPattern(patternId);
          if (!result.ok) {
            toast.error(result.message);
            return;
          }
          toast.success(`Let go of "${name}". Its past choices still count.`);
          router.refresh();
        })
      }
    >
      Let it go
    </Button>
  );
}

/** Name a pattern, the self it pulls against, and the plan that makes it harder. */
export function AddShadowDialog({ identities }: { identities: { id: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    if (!name) {
      setError("Name the pattern, like \"Scrolling in bed\".");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await createShadowPattern({
        name,
        law: String(form.get("law") ?? "") || null,
        plan: String(form.get("plan") ?? "") || null,
        identityId: String(form.get("identityId") ?? "") || null,
      });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast.success("Added. Noticing it is the first step.");
      setOpen(false);
      router.refresh();
    });
  };

  const selectClass = "border-input bg-input-surface text-foreground min-h-11 w-full rounded-lg border px-3 text-body";

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Plus className="size-4" aria-hidden />
          Add pattern
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[20px] p-5 sm:max-w-lg sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-sans text-xl font-semibold">Add a pattern</DialogTitle>
          <DialogDescription>
            Something you&apos;re working with. There are no penalties here.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" aria-busy={pending}>
          <div className="space-y-2">
            <Label htmlFor="shadow-name">Pattern</Label>
            <Input id="shadow-name" name="name" maxLength={80} placeholder="Scrolling in bed" className="min-h-11" aria-invalid={!!error} aria-describedby={error ? "shadow-error" : undefined} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="shadow-identity">Pulls against</Label>
            <select id="shadow-identity" name="identityId" className={selectClass} defaultValue="">
              <option value="">No identity</option>
              {identities.map((identity) => (
                <option key={identity.id} value={identity.id}>{identity.name}</option>
              ))}
            </select>
            <p className="text-muted-foreground text-label">Choosing otherwise becomes a vote for this self.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shadow-law">Approach</Label>
            <select id="shadow-law" name="law" className={selectClass} defaultValue={SHADOW_LAWS[0]}>
              {SHADOW_LAWS.map((law) => (
                <option key={law} value={law}>{law}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shadow-plan">The plan</Label>
            <Input id="shadow-plan" name="plan" maxLength={200} placeholder="The phone charges in the hallway overnight" className="min-h-11" />
          </div>
          {error && <p id="shadow-error" role="alert" className="text-destructive text-label">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Add pattern"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
