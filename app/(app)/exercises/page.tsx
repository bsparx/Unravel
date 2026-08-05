import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
    bodyParts: exercise.bodyParts,
    instructions: exercise.instructions,
    prescription: exercise.prescription,
    videoUrl: exercise.videoUrl,
  }));

  return (
    <ExercisesView
      routineId={routine?.id ?? null}
      daysOfWeek={routine?.daysOfWeek ?? []}
      slots={
        routine?.exercises.map((slot) => ({
          dayOfWeek: slot.dayOfWeek,
          position: slot.position,
          exercise: {
            id: slot.exercise.id,
            name: slot.exercise.name,
            equipment: slot.exercise.equipment,
            goal: slot.exercise.goal,
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
