"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";

import { adoptStarterSelf } from "@/app/(app)/identities/starter-actions";
import { IdentitySigil, hueStyle } from "@/components/identity-sigil";
import { Button } from "@/components/ui/button";
import { MAX_IDENTITIES, nextFreeSlot, shortName } from "@/lib/identity-look";
import { STARTER_SELVES, isTaken } from "@/lib/starter-selves";
import { cn } from "@/lib/utils";

const COUNT_WORDS = ["no", "one", "two", "three", "four", "five"];

/**
 * Begin as someone: a grid of ready-made characters, each bringing its first
 * habits. One tap makes the identity, its habits and today's lead, then lands
 * on /day with something to check in.
 *
 * `cast` is the identities that already exist, so a name already in use shows
 * as taken and the preview hue matches the one the server will assign.
 */
export function StarterPicker({
  cast,
  onAdopted,
  className,
}: {
  cast: { name: string; colorSlot: number }[];
  onAdopted?: () => void;
  className?: string;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const full = cast.length >= MAX_IDENTITIES;
  const names = cast.map((identity) => identity.name);
  const usedSlots = cast.map((identity) => identity.colorSlot);

  const adopt = (starterId: string) => {
    setPendingId(starterId);
    startTransition(async () => {
      try {
        const result = await adoptStarterSelf(starterId);
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        toast.success(
          `Welcome, ${result.short}. Your first ${COUNT_WORDS[result.habitCount] ?? result.habitCount} habits are on today.`,
        );
        onAdopted?.();
        router.push("/day");
      } catch {
        toast.error("Couldn't add that character. Try again in a moment.");
      } finally {
        setPendingId(null);
      }
    });
  };

  return (
    <ul className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {STARTER_SELVES.map((starter) => {
        const taken = isTaken(starter, names);
        const slot = usedSlots.includes(starter.colorSlot) && !taken
          ? nextFreeSlot(usedSlots)
          : starter.colorSlot;
        const short = shortName(starter.name);
        return (
          <li
            key={starter.id}
            style={hueStyle(slot)}
            className="border-border bg-card flex min-w-0 flex-col gap-4 rounded-[20px] border p-5"
          >
            <div className="flex min-w-0 items-center gap-3.5">
              <IdentitySigil sigil={starter.sigil} slot={slot} size="lg" />
              <div className="min-w-0">
                <h3 className="font-sans text-lg leading-snug font-semibold break-words">{starter.name}</h3>
                <p className="text-muted-foreground text-label">
                  {starter.kind === "REAL" ? "Real" : "Fictional"} · {starter.archetype}
                </p>
              </div>
            </div>

            <p className={cn("text-body font-medium", taken && "text-muted-foreground")}>
              {starter.statement}
            </p>

            <p className="rounded-xl bg-[color-mix(in_srgb,var(--hue)_9%,transparent)] px-3.5 py-3 text-label">
              <span className="text-muted-foreground block text-micro font-semibold">Asks before starting</span>
              {starter.question}
            </p>

            <div className="border-border border-t pt-3">
              <p className="text-muted-foreground mb-2 text-micro">
                Brings {COUNT_WORDS[starter.habits.length] ?? starter.habits.length} habits
              </p>
              <ul className="space-y-2">
                {starter.habits.map((habit) => (
                  <li key={habit.title} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2.5 text-label">
                    <Check className="mt-0.5 size-4 stroke-2 text-[var(--hue)]" aria-hidden />
                    <span>
                      <span className={cn("block font-semibold", taken && "text-muted-foreground")}>
                        {habit.minimalTask}
                      </span>
                      <span className="text-muted-foreground text-micro">{habit.cue}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-auto pt-1">
              {taken ? (
                <p className="text-muted-foreground flex min-h-11 items-center justify-center gap-2 text-label font-semibold">
                  <Check className="size-4 text-[var(--hue)]" aria-hidden />
                  Already in your cast
                </p>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => adopt(starter.id)}
                  disabled={full || (pendingId !== null && pendingId !== starter.id)}
                  loading={pendingId === starter.id}
                >
                  {pendingId !== starter.id && <ArrowRight className="size-4" aria-hidden />}
                  Begin as {short}
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
