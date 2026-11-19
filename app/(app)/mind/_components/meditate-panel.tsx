"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { GuideCard } from "@/components/guides/guide-card";
import { InfoTip } from "@/components/info-tip";
import { MeditationPicker, type MeditationChoice } from "@/components/meditation/meditation-picker";
import { SceneCard } from "@/components/scenes/scene-card";
import { Button } from "@/components/ui/button";
import type { MeditationView } from "@/lib/mind-data";
import { findMeditation, normalizeOptions } from "@/lib/meditations";

import { deleteMeditation } from "../actions";

const DEFAULT_CHOICE: MeditationChoice = { kind: "box", options: { n: 4, minutes: 5 } };
const PAGE_SIZE = 10;

/**
 * Meditation: the garden as the days have kept it, the meditations to
 * choose from, and the sittings so far.
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
  const minutesOn = new Map(view.days.map((day) => [day.dateISO, day.minutes]));

  const begin = () => {
    const meditation = findMeditation(choice.kind);
    if (!meditation) return;
    onBegin({ kind: choice.kind, options: normalizeOptions(meditation, choice.options) });
  };

  return (
    <div className="space-y-12">
      <SceneCard
        tab="meditate"
        tending={view.tending}
        note={(day) => {
          const sat = minutesOn.get(day.dateISO) ?? 0;
          return sat > 0 ? `${Math.max(1, Math.round(sat))} min` : null;
        }}
      />

      <GuideCard guide="meditate" firstTime={view.recent.length === 0} />

      {/* Choose. */}
      <section aria-label="Choose a meditation" className="space-y-4">
        <div className="flex items-center gap-1">
          <h2 className="font-display text-title">Sit</h2>
          <InfoTip term="meditation" />
        </div>
        <MeditationPicker value={choice} onChange={setChoice} onBegin={begin} />
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

function minutesLabel(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}
