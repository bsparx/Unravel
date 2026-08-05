-- CreateEnum
CREATE TYPE "ExerciseEquipment" AS ENUM ('YOGA', 'DUMBBELL');

-- CreateEnum
CREATE TYPE "ExerciseGoal" AS ENUM ('HIP_FLEXOR_MOBILITY', 'GLUTE_STRENGTH', 'HAMSTRING_LENGTH', 'CORE_STABILITY', 'LOWER_BACK_RELIEF', 'UPPER_BACK_STRENGTH', 'CHEST_MOBILITY', 'POSTURE_AWARENESS');

-- CreateEnum
CREATE TYPE "BodyPart" AS ENUM ('HIP_FLEXORS', 'QUADS', 'GLUTES', 'HAMSTRINGS', 'CORE', 'LOWER_BACK', 'UPPER_BACK', 'SHOULDERS', 'CHEST', 'SPINE', 'FULL_BODY');

-- CreateTable
CREATE TABLE "Exercise" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "equipment" "ExerciseEquipment" NOT NULL,
    "goal" "ExerciseGoal" NOT NULL,
    "bodyParts" "BodyPart"[],
    "instructions" TEXT[],
    "prescription" TEXT NOT NULL,
    "videoUrl" TEXT,
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExerciseRoutine" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "daysOfWeek" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExerciseRoutine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineExercise" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "swapped" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RoutineExercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Exercise_equipment_goal_idx" ON "Exercise"("equipment", "goal");

-- CreateIndex
CREATE INDEX "Exercise_equipment_active_sortOrder_idx" ON "Exercise"("equipment", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_name_key" ON "Exercise"("name");

-- CreateIndex
CREATE INDEX "ExerciseRoutine_userId_idx" ON "ExerciseRoutine"("userId");

-- CreateIndex
CREATE INDEX "RoutineExercise_routineId_dayOfWeek_idx" ON "RoutineExercise"("routineId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "RoutineExercise_exerciseId_idx" ON "RoutineExercise"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineExercise_routineId_dayOfWeek_position_key" ON "RoutineExercise"("routineId", "dayOfWeek", "position");

-- AddForeignKey
ALTER TABLE "ExerciseRoutine" ADD CONSTRAINT "ExerciseRoutine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineExercise" ADD CONSTRAINT "RoutineExercise_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "ExerciseRoutine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineExercise" ADD CONSTRAINT "RoutineExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
