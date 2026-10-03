import { Check, Eye, Moon } from "lucide-react";

import { IdentityChip } from "@/components/identity-sigil";
import { InfoTip } from "@/components/info-tip";
import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";
import { getShadowWeek } from "@/lib/shadows";
import { cn } from "@/lib/utils";

import { AddShadowDialog, LetGoButton, ShadowMarkButtons } from "./shadow-controls";

const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "narrow", timeZone: "UTC" });
const times = (n: number) => (n === 1 ? "once" : n === 2 ? "twice" : `${n} times`);

/**
 * The shadow side: patterns being broken. Habitica's negative habits without
 * the damage — noticing is information, choosing otherwise is a vote.
 */
export async function ShadowSection({ user }: { user: User }) {
  const [patterns, identities] = await Promise.all([
    getShadowWeek(user),
    prisma.identity.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
  ]);

  return (
    <section aria-labelledby="shadow-title" className="mt-12">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 id="shadow-title" className="font-sans text-heading font-semibold">
            The shadow side <InfoTip term="shadow" className="ml-1" />
          </h2>
          <p className="text-muted-foreground mt-1 max-w-prose text-label">
            Patterns you&apos;re working with. Noticing one is useful information, never a failure.
            Choosing otherwise is a vote.
          </p>
        </div>
        <AddShadowDialog identities={identities} />
      </div>

      {patterns.length === 0 ? (
        <p className="text-muted-foreground bg-muted rounded-2xl p-5 text-label">
          Nothing here yet. Name one pattern you&apos;d like to see more clearly, and the self it pulls against.
        </p>
      ) : (
        <ul className="grid gap-5 md:grid-cols-2">
          {patterns.map((pattern) => {
            const noticed = pattern.week.filter((day) => day.mark === "NOTICED").length;
            const chose = pattern.week.filter((day) => day.mark === "CHOSE").length;
            const parts = [noticed ? `noticed it ${times(noticed)}` : "", chose ? `chose otherwise ${times(chose)}` : ""].filter(Boolean);
            return (
              <li key={pattern.id} className="border-border bg-muted flex min-w-0 flex-col gap-4 rounded-[20px] border p-5">
                <div className="flex items-center gap-3.5">
                  <span aria-hidden className="bg-secondary text-foreground grid size-10 shrink-0 place-items-center rounded-xl">
                    <Moon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-title font-semibold break-words">{pattern.name}</h3>
                    {pattern.against && (
                      <p className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-micro">
                        Pulls against
                        <IdentityChip name={pattern.against.short} sigil={pattern.against.sigil} slot={pattern.against.colorSlot} />
                      </p>
                    )}
                  </div>
                </div>

                {(pattern.law || pattern.plan) && (
                  <p className="text-label">
                    {pattern.law && <span className="text-muted-foreground block text-micro font-semibold">{pattern.law}</span>}
                    {pattern.plan}
                  </p>
                )}

                <div
                  role="img"
                  aria-label={`This week: noticed on ${noticed} ${noticed === 1 ? "day" : "days"}, chose otherwise on ${chose} ${chose === 1 ? "day" : "days"}.`}
                  className="grid grid-cols-7 gap-1.5"
                >
                  {pattern.week.map((day) => (
                    <span key={day.dateISO} className={cn("text-muted-foreground flex flex-col items-center gap-1 text-micro", day.isToday && "text-foreground font-semibold")}>
                      <span
                        style={pattern.against ? ({ "--hue": `var(--id-${pattern.against.colorSlot})` } as React.CSSProperties) : undefined}
                        className={cn(
                          "border-border bg-input-surface grid size-8 place-items-center rounded-md border",
                          day.mark === "NOTICED" && "border-input bg-secondary text-foreground",
                          day.mark === "CHOSE" && "border-[color-mix(in_srgb,var(--hue,var(--primary))_55%,transparent)] bg-[color-mix(in_srgb,var(--hue,var(--primary))_16%,var(--input-surface))] text-[var(--hue,var(--primary))]",
                          day.isFuture && "border-dashed bg-transparent",
                        )}
                      >
                        {day.mark === "CHOSE" ? <Check className="size-4" /> : day.mark === "NOTICED" ? <Eye className="size-4" /> : null}
                      </span>
                      {WEEKDAY.format(new Date(`${day.dateISO}T00:00:00Z`))}
                    </span>
                  ))}
                </div>

                <ShadowMarkButtons patternId={pattern.id} today={pattern.today} against={pattern.against?.short ?? null} />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-muted-foreground text-micro">
                    {parts.length ? `This week you ${parts.join(" and ")}.` : "Nothing logged this week yet."}
                  </p>
                  <LetGoButton patternId={pattern.id} name={pattern.name} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
