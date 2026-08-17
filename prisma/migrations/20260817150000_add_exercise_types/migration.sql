-- AlterEnum
ALTER TYPE "ExerciseGoal" ADD VALUE IF NOT EXISTS 'LEG_STRENGTH';
ALTER TYPE "ExerciseGoal" ADD VALUE IF NOT EXISTS 'PUSH_STRENGTH';
ALTER TYPE "ExerciseGoal" ADD VALUE IF NOT EXISTS 'BALANCE';
ALTER TYPE "ExerciseGoal" ADD VALUE IF NOT EXISTS 'CARDIO';
ALTER TYPE "ExerciseGoal" ADD VALUE IF NOT EXISTS 'HIP_MOBILITY';
ALTER TYPE "ExerciseGoal" ADD VALUE IF NOT EXISTS 'ANKLE_MOBILITY';
ALTER TYPE "ExerciseGoal" ADD VALUE IF NOT EXISTS 'CALF_STRENGTH';

-- AlterEnum
ALTER TYPE "BodyPart" ADD VALUE IF NOT EXISTS 'ADDUCTORS';
ALTER TYPE "BodyPart" ADD VALUE IF NOT EXISTS 'ANKLES';
ALTER TYPE "BodyPart" ADD VALUE IF NOT EXISTS 'ARMS';

-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('STRENGTH', 'MOBILITY', 'FLOW');

-- CreateEnum
CREATE TYPE "RoutineDayType" AS ENUM ('STANDARD', 'FLOW', 'RECOVERY');

-- AlterTable: the type column arrives with a mobility default so existing rows
-- stay valid, is backfilled by name where a goal understates or overstates
-- the work, and loses the default — the catalog always says what it is.
ALTER TABLE "Exercise" ADD COLUMN "type" "ExerciseType" NOT NULL DEFAULT 'MOBILITY';

-- Strength first: every goal whose job is holding against load.
UPDATE "Exercise" SET "type" = 'STRENGTH'
  WHERE "goal" IN ('GLUTE_STRENGTH', 'CORE_STABILITY', 'UPPER_BACK_STRENGTH', 'NECK_STRENGTH');

-- Corrections by name: stretches filed under strength goals, and the one
-- loaded hinge filed under a length goal.
UPDATE "Exercise" SET "type" = 'MOBILITY' WHERE "name" IN ('Eagle Arms', 'Standing Forward Fold', 'Downward-Facing Dog', 'Pelvic Tilts', 'Child''s Pose');
UPDATE "Exercise" SET "type" = 'STRENGTH' WHERE "name" = 'Dumbbell Romanian Deadlift';

ALTER TABLE "Exercise" ALTER COLUMN "type" DROP DEFAULT;

-- AlterTable: routines built before day types existed were all plain
-- workdays — backfill STANDARD across the week, then drop the default.
ALTER TABLE "ExerciseRoutine" ADD COLUMN "dayTypes" "RoutineDayType"[] NOT NULL DEFAULT '{}';

UPDATE "ExerciseRoutine" SET "dayTypes" = ARRAY(
  SELECT 'STANDARD'::"RoutineDayType"
  FROM generate_series(1, array_length("daysOfWeek", 1))
);

ALTER TABLE "ExerciseRoutine" ALTER COLUMN "dayTypes" DROP DEFAULT;
