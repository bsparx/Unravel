-- CreateEnum
CREATE TYPE "ExerciseDifficulty" AS ENUM ('EASY', 'MODERATE', 'HARD');

-- CreateEnum
CREATE TYPE "RoutineDifficulty" AS ENUM ('EASY', 'CHALLENGING');

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "difficulty" "ExerciseDifficulty" NOT NULL DEFAULT 'MODERATE';

-- AlterTable
ALTER TABLE "ExerciseRoutine" ADD COLUMN     "difficulty" "RoutineDifficulty" NOT NULL DEFAULT 'CHALLENGING';
