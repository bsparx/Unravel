"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { InfoTip } from "@/components/info-tip";
import { GardenScene } from "@/components/meditation/garden-scene";
import { MeditationPicker, type MeditationChoice } from "@/components/meditation/meditation-picker";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { GARDEN_STAGES, nextStage, stagesAt, towardNext } from "@/lib/garden";
import type { MeditationView } from "@/lib/mind-data";
import { findMeditation, normalizeOptions } from "@/lib/meditations";
import { cn } from "@/lib/utils";

import { deleteMeditation } from "../actions";

const DEFAULT_CHOICE: MeditationChoice = { kind: "box", options: { n: 4, minutes: 5 } };
const PAGE_SIZE = 10;

/**
 * Meditation: the garden your minutes have grown, the meditations to choose
 * from, and the sittings so far. The garden only grows; nothing here counts
 * a streak or marks a missed day.
 */
export function MeditatePanel({
  view,
  onBegin,
}: {
  view: MeditationView;
  onBegin: (choice: MeditationChoice) => void;
}) {
  const [choice, setChoice] = useState<MeditationChoice>(() => {
    const last = view.last && findMeditation(view.last.kind) ? view.last : DEFAULT_CHOICE;
    return last;
  });
  const [shown, setShown] = useState(PAGE_SIZE);

  const minutes = view.totalMinutes;
  const reached = stagesAt(minutes);

  const begin = () => {
    const meditation = findMeditation(choice.kind);
    if (!meditation) return;
    onBegin({ kind: choice.kind, options: normalizeOptions(meditation, choice.options) });
  };

  return (
    <div className="space-y-12">
      {/* The garden. */}
      <section aria-label="Your garden" className="space-y-3">
        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl shadow-[0_24px_60px_-30px_rgba(30,20,70,0.55)] sm:aspect-[2/1] lg:aspect-[21/9]">
          <GardenScene minutes={minutes} />
          {/* From sm up the caption sits in the sky, where the garden never
              grows. On a phone the crop puts the moon right behind it, so
              there it's plain text under the scene instead. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 hidden bg-gradient-to-b from-black/30 to-transparent px-7 pt-6 pb-10 text-white sm:block">
            <GardenCaption minutes={minutes} onSky />
          </div>
        </div>
        <div className="sm:hidden">
          <GardenCaption minutes={minutes} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground mr-1 flex items-center gap-1 text-label">
            In your garden <InfoTip term="garden" />
          </span>
          {reached.map((stage) => (
            <Tooltip key={stage.id}>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="border-border focus-visible:ring-ring rounded-full border px-2.5 py-0.5 text-micro focus-visible:ring-2 focus-visible:outline-none">
                  {stage.name}
                </span>
              </TooltipTrigger>
              <TooltipContent side="top">
                {stage.minutes === 0 ? "Here from the start" : `Grew at ${stage.minutes} minutes`}
              </TooltipContent>
            </Tooltip>
          ))}
          <span className="text-muted-foreground text-micro">
            {reached.length} of {GARDEN_STAGES.length}
          </span>
        </div>
      </section>

      {/* Choose. */}
      <section aria-label="Choose a meditation" className="space-y-4">
        <div className="flex items-center gap-1">
          <h2 className="font-display text-title">Sit</h2>
          <InfoTip term="meditation" />
        </div>
        <MeditationPicker value={choice} onChange={setChoice} onBegin={begin} />
      </section>

      {/* Two weeks, and the sittings. */}
      <section aria-label="The last two weeks" className="space-y-2">
        <h3 className="text-body font-medium">Last two weeks</h3>
        <ol className="flex flex-wrap gap-1.5">
          {view.days.map((day) => {
            const isToday = day.dateISO === view.todayISO;
            const sat = Math.round(day.minutes);
            const text = `${isToday ? "Today" : day.label} · ${day.minutes > 0 ? `${Math.max(1, sat)} min` : "no sitting"}`;
            return (
              <li key={day.dateISO}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      aria-label={text}
                      className={cn(
                        "focus-visible:ring-ring block size-4 rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none",
                        day.minutes > 0 ? "bg-[var(--garden-light)]" : "border-border border bg-transparent",
                        isToday && "ring-foreground/30 ring-2 ring-offset-2 ring-offset-[var(--background)]",
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">{text}</TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ol>
      </section>

      {view.recent.length > 0 && (
        <section aria-label="Recent sittings" className="space-y-3">
          <h3 className="text-body font-medium">Recent sittings</h3>
          <ol className="border-border divide-border divide-y rounded-2xl border">
            {view.recent.slice(0, shown).map((row) => (
              <li key={row.id} className="group flex items-center gap-3 py-3 pr-2 pl-4 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-label sm:text-body truncate">{row.title}</p>
                  <p className="text-muted-foreground text-micro">
                    {row.label}
                    {row.completed ? "" : " · ended early"}
                    {row.count !== null && row.kind === "dhikr" ? ` · ${row.count} counted` : ""}
                  </p>
                </div>
                <span className="font-display text-lg whitespace-nowrap tabular-nums">{minutesLabel(row.seconds)}</span>
                <ConfirmDialog
                  title="Delete this sitting?"
                  description={`${row.title}, ${minutesLabel(row.seconds)}. Its minutes leave the garden too.`}
                  onConfirm={async () => {
                    await deleteMeditation(row.id);
                    toast.success("Deleted.");
                  }}
                  trigger={(open) => (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={open}
                      aria-label={`Delete the sitting from ${row.label}`}
                      className="hover:text-destructive rounded-full transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                    >
                      <Trash2 className="size-3.5" aria-hidden />
                    </Button>
                  )}
                />
              </li>
            ))}
          </ol>
          {view.recent.length > shown && (
            <Button type="button" variant="ghost" className="rounded-full" onClick={() => setShown((n) => n + PAGE_SIZE)}>
              Show older
            </Button>
          )}
        </section>
      )}
    </div>
  );
}

function GardenCaption({ minutes, onSky = false }: { minutes: number; onSky?: boolean }) {
  const whole = Math.floor(minutes);
  const next = nextStage(minutes);
  return (
    <>
      <p className="font-display text-2xl leading-tight sm:text-3xl">
        {whole === 0
          ? "A quiet meadow, waiting"
          : `${whole.toLocaleString("en-GB")} ${whole === 1 ? "minute" : "minutes"} in the garden`}
      </p>
      <p className={cn("mt-1 text-sm", onSky ? "text-white/85" : "text-muted-foreground")}>
        {next
          ? `Next: ${next.name.toLowerCase()} at ${next.minutes} minutes`
          : "The garden is whole. It stays this way, and so does every minute."}
      </p>
      {next && (
        <div
          className={cn("mt-2.5 h-1 w-full max-w-xs overflow-hidden rounded-full", onSky ? "bg-white/25" : "bg-muted")}
          aria-hidden
        >
          <div
            className={cn("h-full rounded-full", onSky ? "bg-white/85" : "bg-[var(--garden-light)]")}
            style={{ width: `${Math.round(towardNext(minutes) * 100)}%` }}
          />
        </div>
      )}
    </>
  );
}

function minutesLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}
