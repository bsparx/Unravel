"use client";

import { useState } from "react";
import {
  Check,
  Clock,
  Dumbbell,
  ExternalLink,
  Play,
  Sparkles,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  EXERCISE_DIFFICULTY_LABELS,
  EXERCISE_TYPE_LABELS,
  GOAL_LABELS,
  goalShort,
} from "@/lib/exercise-labels";
import type {
  ExerciseDifficulty,
  ExerciseGoal,
  ExerciseType,
} from "@/lib/exercise-routine";
import { cn } from "@/lib/utils";

import { ExerciseFigure } from "./exercise-figure";

export type ExerciseDetail = {
  id: string;
  name: string;
  equipment: "YOGA" | "DUMBBELL";
  goal: ExerciseGoal;
  type: ExerciseType;
  difficulty: ExerciseDifficulty;
  bodyParts: string[];
  instructions: string[];
  prescription: string;
  videoUrl: string | null;
};

/** A YouTube watch URL -> the embeddable src, when the link is shareable. */
function embedSrc(url: string | null): string | null {
  if (!url) return null;
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/,
  );
  return match ? `https://www.youtube-nocookie.com/embed/${match[1]}` : null;
}

export function ExerciseDetailDialog({
  exercise,
  canCheck = false,
  checked = false,
  onToggleCheck,
  children,
}: {
  exercise: ExerciseDetail;
  /** True when opened from today's training slot so the user can check it off right here. */
  canCheck?: boolean;
  checked?: boolean;
  onToggleCheck?: () => void;
  /** The control that opens the dialog. */
  children: (open: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const embed = embedSrc(exercise.videoUrl);
  const isYoga = exercise.equipment === "YOGA";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children(() => setOpen(true))}
      <DialogContent
        sheetOnPhone
        showCloseButton={false}
        className="flex flex-col gap-0 overflow-hidden p-0 sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-[26px] lg:max-w-4xl xl:max-w-5xl"
      >
        {/* Serene sticky header */}
        <header className="border-border/60 bg-popover/95 flex shrink-0 items-start justify-between gap-4 border-b px-5 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 backdrop-blur sm:px-8 sm:pt-7 sm:pb-5">
          <div className="min-w-0 space-y-2.5">
            <div className="flex flex-wrap items-center gap-1.5 text-micro font-medium">
              <span className="border-border/70 bg-muted/60 text-foreground inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5">
                {isYoga ? (
                  <Sparkles className="text-primary size-3" aria-hidden />
                ) : (
                  <Dumbbell className="text-primary size-3" aria-hidden />
                )}
                {isYoga ? "Yoga · mat only" : "Dumbbells · light"}
              </span>
              <span className="bg-accent/80 text-accent-foreground rounded-full px-2.5 py-0.5">
                {goalShort(exercise.goal)}
              </span>
              <span className="border-border/70 text-muted-foreground rounded-full border px-2.5 py-0.5">
                {EXERCISE_DIFFICULTY_LABELS[exercise.difficulty]}
              </span>
            </div>

            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
              <DialogTitle className="font-display pr-0 text-2xl leading-tight font-medium sm:text-[30px]">
                {exercise.name}
              </DialogTitle>
              <span className="bg-muted/70 text-foreground inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-label font-medium tabular-nums">
                <Clock className="text-muted-foreground size-3.5" aria-hidden />
                {exercise.prescription}
              </span>
            </div>

            <DialogDescription className="sr-only">
              How to perform {exercise.name}: {exercise.prescription}.{" "}
              {GOAL_LABELS[exercise.goal]}.
            </DialogDescription>
          </div>

          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close"
              className="text-muted-foreground hover:text-foreground -mt-1 -mr-1 size-10 shrink-0 rounded-full"
            >
              <X className="size-4.5" aria-hidden />
            </Button>
          </DialogClose>
        </header>

        {/* Spacious scrollable body: single column on phone/tablet, calm 2-column split on desktop */}
        <div
          className={cn(
            "min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-8 sm:py-7",
            !canCheck && "max-sm:pb-[max(2rem,env(safe-area-inset-bottom))]",
          )}
        >
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1.25fr)_minmax(21rem,0.9fr)] lg:items-start lg:gap-9">
            {/* Left column: Demonstration video + step-by-step guide */}
            <div className="min-w-0 space-y-7">
              {embed && (
                <section aria-label="Video demonstration" className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-micro text-muted-foreground inline-flex items-center gap-1.5 font-medium tracking-wider uppercase">
                      <Play className="size-3" aria-hidden />
                      Demonstration
                    </h3>
                    {exercise.videoUrl && (
                      <a
                        href={exercise.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-micro font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                      >
                        Open on YouTube
                        <ExternalLink className="size-3" aria-hidden />
                      </a>
                    )}
                  </div>
                  <div className="border-border/70 bg-muted/40 aspect-video overflow-hidden rounded-2xl border shadow-xs">
                    <iframe
                      src={embed}
                      title={`${exercise.name} — video`}
                      className="size-full"
                      loading="lazy"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  </div>
                </section>
              )}

              <section aria-label="How to do it" className="space-y-3.5">
                <h3 className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
                  How to do it
                </h3>
                <ol className="space-y-3.5">
                  {exercise.instructions.map((step, index) => (
                    <li
                      key={index}
                      className="flex items-start gap-3.5 text-body leading-relaxed text-foreground/90"
                    >
                      <span
                        className="bg-accent text-accent-foreground mt-0.5 grid size-6 shrink-0 place-items-center rounded-full font-mono text-micro font-semibold tabular-nums"
                        aria-hidden
                      >
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1">{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            {/* Right column: Anatomy plate + concise purpose summary (sticky on desktop) */}
            <aside className="space-y-4 lg:sticky lg:top-0">
              <div className="space-y-2.5">
                <h3 className="text-micro text-muted-foreground font-medium tracking-wider uppercase">
                  Muscles worked
                </h3>
                <ExerciseFigure
                  name={exercise.name}
                  parts={exercise.bodyParts}
                  className="border-border/60 bg-muted/30 rounded-2xl px-3.5 py-5"
                />
              </div>

              <div className="border-border/60 bg-muted/25 grid grid-cols-2 gap-3 rounded-2xl border px-4 py-3.5">
                <div>
                  <p className="text-micro text-muted-foreground">Focus</p>
                  <p className="mt-0.5 text-label font-medium text-foreground">
                    {GOAL_LABELS[exercise.goal]}
                  </p>
                </div>
                <div>
                  <p className="text-micro text-muted-foreground">Style</p>
                  <p className="mt-0.5 text-label font-medium text-foreground">
                    {EXERCISE_TYPE_LABELS[exercise.type]} ·{" "}
                    {EXERCISE_DIFFICULTY_LABELS[exercise.difficulty]}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* Sticky check-off action bar when opened from today's routine */}
        {canCheck && onToggleCheck && (
          <footer className="border-border/60 bg-popover/95 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t px-5 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-8 sm:py-4">
            <p className="text-muted-foreground text-label max-sm:hidden">
              {checked
                ? "Counted toward today's workout."
                : "Checking off even one exercise counts today."}
            </p>
            <Button
              type="button"
              onClick={onToggleCheck}
              className={cn(
                "min-h-11 rounded-full px-5 max-sm:w-full",
                checked &&
                  "bg-flow text-flow-foreground hover:bg-flow/90",
              )}
            >
              <Check className="size-4 stroke-[2.5]" aria-hidden />
              {checked ? "Done for today" : "Check off for today"}
            </Button>
          </footer>
        )}
      </DialogContent>
    </Dialog>
  );
}
