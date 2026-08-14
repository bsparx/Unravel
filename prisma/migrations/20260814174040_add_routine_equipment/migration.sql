-- CreateEnum
CREATE TYPE "RoutineEquipment" AS ENUM ('YOGA', 'DUMBBELL', 'MIX');

-- AlterTable
ALTER TABLE "ExerciseRoutine" ADD COLUMN     "equipment" "RoutineEquipment" NOT NULL DEFAULT 'MIX';
