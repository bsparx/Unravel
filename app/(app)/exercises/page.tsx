import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayLocal } from "@/lib/dates";

import { ExercisesView } from "./_components/exercises-view";

export const metadata = { title: "Exercises" };

export default async function ExercisesPage() {
  const user = await requireUser();

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

  const catalog = exercises.map((exercise) => ({
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
  }));

  return (
    <ExercisesView
      // The week's "today" chip. Server-computed because a weekday doesn't
      // change mid-session, so there's nothing to hydrate-mismatch.
      todayDow={todayLocal(user.timezone).getUTCDay()}
      routineId={routine?.id ?? null}
      equipment={routine?.equipment ?? "MIX"}
      difficulty={routine?.difficulty ?? "CHALLENGING"}
      daysOfWeek={routine?.daysOfWeek ?? []}
      dayTypes={routine?.dayTypes ?? []}
      slots={
        routine?.exercises.map((slot) => ({
          dayOfWeek: slot.dayOfWeek,
          position: slot.position,
          swapped: slot.swapped,
          exercise: {
            id: slot.exercise.id,
            name: slot.exercise.name,
            equipment: slot.exercise.equipment,
            goal: slot.exercise.goal,
            type: slot.exercise.type,
            difficulty: slot.exercise.difficulty,
            bodyParts: slot.exercise.bodyParts,
            instructions: slot.exercise.instructions,
            prescription: slot.exercise.prescription,
            videoUrl: slot.exercise.videoUrl,
          },
        })) ?? []
      }
      catalog={catalog}
    />
  );
}
