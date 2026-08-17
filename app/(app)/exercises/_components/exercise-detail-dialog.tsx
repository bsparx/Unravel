"use client";

import { useState } from "react";
import { Dumbbell, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  EXERCISE_TYPE_LABELS,
  GOAL_LABELS,
  goalShort,
} from "@/lib/exercise-labels";
import type { ExerciseGoal, ExerciseType } from "@/lib/exercise-routine";

import { ExerciseFigure } from "./exercise-figure";

export type ExerciseDetail = {
  id: string;
  name: string;
  equipment: "YOGA" | "DUMBBELL";
  goal: ExerciseGoal;
  type: ExerciseType;
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
  children,
}: {
  exercise: ExerciseDetail;
  /** The control that opens the dialog. */
  children: (open: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const embed = embedSrc(exercise.videoUrl);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children(() => setOpen(true))}
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="font-display text-heading">
                {exercise.name}
              </DialogTitle>
              <p className="text-muted-foreground mt-1 text-label">
                {exercise.equipment === "YOGA" ? "Yoga · mat only" : "Dumbbells · light"} ·{" "}
                {goalShort(exercise.goal)}
              </p>
            </div>
            <Badge
              variant="outline"
              className="shrink-0"
              aria-label={exercise.equipment}
            >
              {exercise.equipment === "YOGA" ? (
                <Sparkles className="size-3" aria-hidden />
              ) : (
                <Dumbbell className="size-3" aria-hidden />
              )}
            </Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-body font-medium">{exercise.prescription}</p>

          <ExerciseFigure name={exercise.name} parts={exercise.bodyParts} />

          <Separator />

          <div>
            <p className="text-micro text-muted-foreground mb-2 tracking-wide uppercase">
              What it is for
            </p>
            {/* The goal and the type. The figure above already names every
                muscle this works, in the same words and on the body itself. */}
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{GOAL_LABELS[exercise.goal]}</Badge>
              <Badge variant="outline">
                {EXERCISE_TYPE_LABELS[exercise.type]}
              </Badge>
            </div>
          </div>

          <div>
            <p className="text-micro text-muted-foreground mb-2 tracking-wide uppercase">
              How to do it
            </p>
            <ol className="space-y-2">
              {exercise.instructions.map((step, index) => (
                <li key={index} className="text-body text-foreground/90 flex gap-3">
                  <span
                    className="text-primary tnum mt-0.5 shrink-0 text-label"
                    aria-hidden
                  >
                    {index + 1}
                  </span>
                  <span className="text-label">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {embed && (
            <div>
              <p className="text-micro text-muted-foreground mb-2 tracking-wide uppercase">
                Watch it
              </p>
              <div className="aspect-video overflow-hidden rounded-lg border">
                <iframe
                  src={embed}
                  title={`${exercise.name} — video`}
                  className="size-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
