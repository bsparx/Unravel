"use client";

import { useState, type ComponentType } from "react";

import { InfoTip } from "@/components/info-tip";
import { GardenScene } from "@/components/meditation/garden-scene";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { MindTab } from "@/lib/mind-tabs";
import { SCENES, sceneCaption, stageIdsAt } from "@/lib/scenes";
import type { TendDay, Tending } from "@/lib/tending";
import { cn } from "@/lib/utils";

import { BalloonScene } from "./balloon-scene";
import { CourtyardScene } from "./courtyard-scene";
import { HarbourScene } from "./harbour-scene";
import { NookScene } from "./nook-scene";
import type { SceneProps } from "./scene-frame";
import { SummitScene } from "./summit-scene";
import { TerraceScene } from "./terrace-scene";

export const SCENE_ART: Record<MindTab, ComponentType<SceneProps>> = {
  meditate: GardenScene,
  gratitude: TerraceScene,
  dua: CourtyardScene,
  braindump: BalloonScene,
  reading: NookScene,
  wishes: SummitScene,
  disputations: HarbourScene,
};

/** Each practice's own colour for a day kept, as on its tab. */
const DAY_DOT: Record<MindTab, string> = {
  gratitude: "bg-[var(--thanks-lantern)]",
  dua: "bg-[var(--dua-accent)]",
  braindump: "bg-[var(--balloon-env-1)]",
  meditate: "bg-[var(--garden-light)]",
  reading: "bg-[var(--reading-dot)]",
  wishes: "bg-[var(--woop-wish)]",
  disputations: "bg-[var(--abcde-energization)]",
};

/**
 * A practice's scene, at the top of its tab: the place itself, a line on
 * where it stands and what today does for it, and the last fourteen days.
 * When a save brings a new stage, it grows in.
 *
 * `note` says what a day held ("12 min", "20 pages"), for the tooltips.
 */
export function SceneCard({
  tab,
  tending,
  note,
  className,
}: {
  tab: MindTab;
  tending: Tending;
  note?: (day: TendDay) => string | null;
  className?: string;
}) {
  const scene = SCENES[tab];
  const Art = SCENE_ART[tab];
  const caption = sceneCaption(scene, tending);

  // What just arrived: stages between the level last shown and this one.
  // Adjusted during render, not in an effect, so the new stage's first paint
  // is already the growing one.
  const [shown, setShown] = useState(tending.level);
  const [fresh, setFresh] = useState<string[]>([]);
  if (tending.level !== shown) {
    const before = new Set(stageIdsAt(scene, shown));
    setFresh(tending.level > shown ? stageIdsAt(scene, tending.level).filter((id) => !before.has(id)) : []);
    setShown(tending.level);
  }

  return (
    <section aria-label={scene.title} className={cn("space-y-3", className)}>
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl shadow-[0_24px_60px_-30px_rgba(30,20,70,0.55)] ring-1 ring-[var(--woop-glass-edge)] sm:aspect-[2/1] lg:aspect-[21/9]">
        <Art level={tending.level} fresh={fresh} />
      </div>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0 space-y-0.5">
          <p className="text-muted-foreground text-micro">{scene.title}</p>
          <p className="font-display flex items-center gap-1 text-xl leading-tight">
            {caption.title}
            <InfoTip term="scene" />
          </p>
          <p className="text-muted-foreground text-label">{caption.line}</p>
        </div>
        <DayStrip tab={tab} tending={tending} note={note} />
      </div>
    </section>
  );
}

/** The last fourteen days, and today while it's still open. */
function DayStrip({
  tab,
  tending,
  note,
}: {
  tab: MindTab;
  tending: Tending;
  note?: (day: TendDay) => string | null;
}) {
  const days = tending.today ? tending.window : [...tending.window, tending.todayDay];
  const text = (day: TendDay, isToday: boolean) => {
    const when = isToday ? "Today" : day.label;
    if (!day.done) return isToday ? "Today · still open" : `${when} · missed`;
    const extra = note?.(day);
    return extra ? `${when} · ${extra}` : `${when} · kept`;
  };

  return (
    <ol aria-label="The last two weeks" className="flex flex-wrap items-center gap-[3px] sm:gap-1.5">
      {days.map((day) => {
        const isToday = day.dateISO === tending.todayDay.dateISO;
        const label = text(day, isToday);
        return (
          <li key={day.dateISO}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  tabIndex={0}
                  aria-label={label}
                  className={cn(
                    "focus-visible:ring-ring block size-3 rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none sm:size-4",
                    day.done
                      ? DAY_DOT[tab]
                      : isToday
                        ? "border-foreground/50 border border-dashed"
                        : "border-border border bg-transparent",
                    isToday && "ring-foreground/30 ring-2 ring-offset-2 ring-offset-[var(--background)]",
                  )}
                />
              </TooltipTrigger>
              <TooltipContent side="top">{label}</TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ol>
  );
}
