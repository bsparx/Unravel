"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, ChevronLeft, CircleCheck, RotateCcw } from "lucide-react";
import { toast } from "sonner";

import { closeReview } from "@/app/(app)/review/actions";
import { IdentitySigil, hueStyle } from "@/components/identity-sigil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Sigil } from "@/lib/identity-look";
import { cn } from "@/lib/utils";

export type CouncilIdentity = {
  id: string;
  short: string;
  statement: string | null;
  sigil: Sigil;
  colorSlot: number;
  last7: number;
};

const STEPS = ["Look back", "Adjust", "Choose a lead"] as const;

/**
 * The weekly council, three short steps. State lives here until "Close the
 * council"; nothing is written halfway, so leaving mid-way costs nothing.
 */
export function Council({
  identities,
  quiet,
  quietHabit,
  closed,
  weekLabel,
}: {
  identities: CouncilIdentity[];
  quiet: CouncilIdentity | null;
  quietHabit: { id: string; title: string; minimum: string } | null;
  closed: { lead: string | null; statement: string | null; adjustment: string | null } | null;
  weekLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reopened, setReopened] = useState(false);
  const [step, setStep] = useState(0);
  const [reached, setReached] = useState(0);
  const [adjust, setAdjust] = useState<"keep" | "smaller">("smaller");
  const [minimum, setMinimum] = useState(quietHabit?.minimum ?? "");
  const [leadId, setLeadId] = useState<string | null>(quiet?.id ?? identities[0]?.id ?? null);
  const lead = identities.find((identity) => identity.id === leadId) ?? null;
  const [statement, setStatement] = useState(lead?.statement ?? "");
  const [edited, setEdited] = useState(false);

  if (closed && !reopened) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <p className="flex items-center gap-2.5 text-lg font-semibold">
          <CircleCheck className="text-accent-foreground size-5" aria-hidden />
          Council closed for {weekLabel}.
        </p>
        {closed.lead && (
          <p className="text-body">
            {closed.lead} leads{closed.statement ? `: "${closed.statement}"` : "."}
          </p>
        )}
        {closed.adjustment && <p className="text-muted-foreground text-label">{closed.adjustment}</p>}
        <p className="text-muted-foreground text-label">Nothing else needs deciding today.</p>
        <div>
          <Button variant="ghost" onClick={() => setReopened(true)}>
            <RotateCcw className="size-4" aria-hidden />
            Hold it again
          </Button>
        </div>
      </div>
    );
  }

  const go = (next: number) => {
    setStep(next);
    setReached((current) => Math.max(current, next));
  };
  const max = Math.max(1, ...identities.map((identity) => identity.last7));
  const top = [...identities].sort((a, b) => b.last7 - a.last7)[0];

  const close = () =>
    startTransition(async () => {
      const result = await closeReview({
        leadIdentityId: leadId,
        statement: statement.trim() || null,
        habitId: adjust === "smaller" && quietHabit ? quietHabit.id : null,
        newMinimum: adjust === "smaller" && minimum.trim() ? minimum.trim() : null,
      });
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      toast.success(lead ? `Council closed. ${lead.short} leads ${weekLabel}.` : "Council closed.");
      setReopened(false);
      router.refresh();
    });

  return (
    <div className="grid md:grid-cols-[13.5rem_minmax(0,1fr)]">
      <nav aria-label="Council steps" className="bg-muted border-border grid content-start gap-1 border-b p-3 md:border-r md:border-b-0">
        {STEPS.map((label, index) => (
          <button
            key={label}
            type="button"
            disabled={index > reached}
            aria-current={index === step ? "step" : undefined}
            onClick={() => setStep(index)}
            className={cn(
              "text-muted-foreground focus-visible:ring-ring flex min-h-12 items-center gap-3 rounded-[10px] px-3 text-left text-body focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60",
              index === step && "bg-input-surface text-foreground ring-border font-semibold ring-1",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "border-input grid size-6 place-items-center rounded-full border-[1.5px]",
                index < reached && "bg-primary border-primary text-primary-foreground",
              )}
            >
              {index < reached && <Check className="size-3.5 stroke-[2.4]" />}
            </span>
            {label}
          </button>
        ))}
      </nav>

      <div className="flex min-h-96 flex-col gap-5 p-5 sm:p-7" aria-busy={pending}>
        {step === 0 && (
          <>
            <div>
              <h2 className="font-sans text-xl font-semibold">Look back</h2>
              <p className="text-muted-foreground text-label">Votes in the last seven days, by identity.</p>
            </div>
            <ul className="space-y-2.5">
              {identities.map((identity) => (
                <li key={identity.id} style={hueStyle(identity.colorSlot)} className="grid grid-cols-[8rem_minmax(0,1fr)] items-center gap-3 text-label">
                  <span className="flex min-w-0 items-center gap-2">
                    <IdentitySigil sigil={identity.sigil} slot={identity.colorSlot} size="sm" />
                    <span className="truncate">{identity.short}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="h-5 min-w-[3px] rounded-r bg-[var(--hue)]" style={{ width: `${(identity.last7 / max) * 100}%` }} />
                    <span className="font-mono tabular-nums">
                      {identity.last7}
                      <span className="sr-only"> votes</span>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
            {top && quiet && top.id !== quiet.id && (
              <p className="text-muted-foreground text-label">
                {top.short} carried the week. {quiet.short} was quiet, which is information, not a verdict.
              </p>
            )}
          </>
        )}

        {step === 1 && (
          <>
            {quiet && quietHabit ? (
              <>
                <div>
                  <h2 className="font-sans text-xl font-semibold">{quiet.short} was quiet. What would help?</h2>
                  <p className="text-muted-foreground text-label">
                    A smaller minimum isn&apos;t a step back. It&apos;s a door that&apos;s easier to open.
                  </p>
                </div>
                <fieldset className="space-y-2.5">
                  <legend className="sr-only">Change for {quietHabit.title}</legend>
                  {(["keep", "smaller"] as const).map((value) => (
                    <label
                      key={value}
                      className="border-border bg-input-surface has-[:checked]:border-ring has-[:checked]:ring-ring flex cursor-pointer items-start gap-3 rounded-xl border p-4 has-[:checked]:ring-1"
                    >
                      <input type="radio" name="adjust" value={value} checked={adjust === value} onChange={() => setAdjust(value)} className="accent-primary mt-1 size-4" />
                      <span>
                        <strong className="block text-body font-semibold">
                          {value === "keep" ? "Keep it as it is" : "Make the minimum smaller"}
                        </strong>
                        <span className="text-muted-foreground text-label">
                          {value === "keep" ? `${quietHabit.title}: ${quietHabit.minimum}` : "Something you could finish in two minutes."}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                {adjust === "smaller" && (
                  <div className="space-y-2">
                    <Label htmlFor="council-minimum">New minimum for {quietHabit.title}</Label>
                    <Input id="council-minimum" value={minimum} onChange={(event) => setMinimum(event.target.value)} maxLength={120} className="min-h-11" />
                  </div>
                )}
              </>
            ) : (
              <div>
                <h2 className="font-sans text-xl font-semibold">Nothing to adjust</h2>
                <p className="text-muted-foreground text-label">
                  {quiet ? `${quiet.short} has no habits yet. You can link one from Identities.` : "Every self was heard this week."}
                </p>
              </div>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <h2 className="font-sans text-xl font-semibold">Who leads {weekLabel}?</h2>
              <p className="text-muted-foreground text-label">The lead&apos;s habits come first each morning. The others still count.</p>
            </div>
            <fieldset>
              <legend className="sr-only">Lead for {weekLabel}</legend>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(4.5rem,1fr))] gap-1.5">
                {identities.map((identity) => {
                  const checked = identity.id === leadId;
                  return (
                    <label
                      key={identity.id}
                      style={hueStyle(identity.colorSlot)}
                      className={cn(
                        "text-muted-foreground has-[:focus-visible]:ring-ring relative flex min-h-20 cursor-pointer flex-col items-center gap-1.5 rounded-lg border border-transparent px-1 py-2.5 text-micro has-[:focus-visible]:ring-2",
                        checked && "text-foreground border-[color-mix(in_srgb,var(--hue)_55%,transparent)] bg-[color-mix(in_srgb,var(--hue)_10%,var(--input-surface))] font-semibold",
                      )}
                    >
                      <input
                        type="radio"
                        name="council-lead"
                        value={identity.id}
                        checked={checked}
                        onChange={() => {
                          setLeadId(identity.id);
                          if (!edited) setStatement(identity.statement ?? "");
                        }}
                        className="absolute inset-0 cursor-pointer opacity-0"
                      />
                      <IdentitySigil sigil={identity.sigil} slot={identity.colorSlot} />
                      {identity.short}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="council-statement">Their sentence for the week</Label>
              <Input
                id="council-statement"
                value={statement}
                onChange={(event) => {
                  setStatement(event.target.value);
                  setEdited(true);
                }}
                maxLength={200}
                className="min-h-11"
                aria-describedby="council-statement-help"
              />
              <p id="council-statement-help" className="text-muted-foreground text-label">
                Read it on the first morning. Small enough to be true by the end of the week.
              </p>
            </div>
          </>
        )}

        <div className="border-border mt-auto flex items-center justify-between gap-3 border-t pt-4">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={pending}>
              <ChevronLeft className="size-4" aria-hidden />
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < 2 ? (
            <Button onClick={() => go(step + 1)}>
              Next
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          ) : (
            <Button onClick={close} disabled={pending}>
              <Check className="size-4" aria-hidden />
              {pending ? "Closing…" : "Close the council"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
