import type { ComponentProps } from "react";
import Link from "next/link";
import { Settings2 } from "lucide-react";

import { InfoTip } from "@/components/info-tip";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth";
import { bodyEnabled, getFasting } from "@/lib/body-data";
import { enabledBodyTabs, type BodyEnabled, type BodyTab } from "@/lib/body-tabs";
import { prisma } from "@/lib/db";
import { todayLocal } from "@/lib/dates";
import type { User } from "@/lib/generated/prisma/client";

import { BodyBoard } from "./_components/body-board";
import { ExercisesView } from "./_components/exercises-view";

export const metadata = { title: "Body" };

export type ExercisesData = ComponentProps<typeof ExercisesView>;

/**
 * The body's two daily things, each switchable in Settings: the corrective
 * exercise week (with the body-map catalog under it), and intermittent
 * fasting (one eating window, and a log of real fasts). Only what's on is
 * loaded.
 */
export default async function BodyPage({ searchParams }: PageProps<"/body">) {
  const user = await requireUser();
  const enabled = bodyEnabled(user);
  const [params, exercises, fasting] = await Promise.all([
    searchParams,
    enabled.exercises ? loadExercises(user) : null,
    enabled.fasting ? getFasting(user) : null,
  ]);
  const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;

  const tabs = enabledBodyTabs(enabled);
  // A tab that's switched off (or never existed) lands on the first one on.
  const tab: BodyTab | undefined = tabs.find((value) => value === raw) ?? tabs[0];

  return (
    <div className="mx-auto w-full max-w-7xl px-5 py-8 md:px-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-display">
          Body <InfoTip term="body" className="ml-1" />
        </h1>
        {tab && <p className="text-muted-foreground mt-2 max-w-prose text-body">{intro(enabled)}</p>}
      </header>

      {tab ? (
        <BodyBoard initialTab={tab} tabs={tabs} exercises={exercises} fasting={fasting} />
      ) : (
        <div className="border-border mx-auto max-w-md rounded-2xl border border-dashed px-6 py-14 text-center">
          <p className="font-display text-2xl">Body is switched off</p>
          <p className="text-muted-foreground mt-2 text-body">
            Exercises and intermittent fasting can each be turned on in Settings, together or on their own.
          </p>
          <Button asChild className="mt-6 rounded-full">
            <Link href="/settings#body">
              <Settings2 className="size-4" aria-hidden />
              Choose sections
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function intro(enabled: BodyEnabled): string {
  if (enabled.exercises && enabled.fasting) {
    return "Your week of exercises, and the hours you eat in.";
  }
  return enabled.exercises ? "Your week of exercises." : "The hours you eat in, and the fasts between.";
}

async function loadExercises(user: User): Promise<ExercisesData> {
  const [exercises, routine] = await Promise.all([
    prisma.exercise.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.exerciseRoutine.findFirst({
      where: { userId: user.id },
      include: { exercises: { include: { exercise: true } } },
    }),
  ]);

  const detail = (exercise: (typeof exercises)[number]) => ({
    id: exercise.id,
    name: exercise.name,
    equipment: exercise.equipment,
    goal: exercise.goal,
    type: exercise.type,
    difficulty: exercise.difficulty,
    bodyParts: exercise.bodyParts,
    instructions: exercise.instructions,
    prescription: exercise.prescription,
    videoUrl: exercise.videoUrl,
  });

  return {
    // The week's "today" chip. Server-computed because a weekday doesn't
    // change mid-session, so there's nothing to hydrate-mismatch.
    todayDow: todayLocal(user.timezone).getUTCDay(),
    routineId: routine?.id ?? null,
    equipment: routine?.equipment ?? "MIX",
    difficulty: routine?.difficulty ?? "CHALLENGING",
    daysOfWeek: routine?.daysOfWeek ?? [],
    dayTypes: routine?.dayTypes ?? [],
    slots:
      routine?.exercises.map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        position: slot.position,
        swapped: slot.swapped,
        exercise: detail(slot.exercise),
      })) ?? [],
    catalog: exercises.map(detail),
  };
}
