-- CreateEnum
CREATE TYPE "HabitSlot" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING', 'ALWAYS');

-- AlterTable
ALTER TABLE "HabitRecurrence" ADD COLUMN     "slots" "HabitSlot"[] DEFAULT ARRAY['ALWAYS']::"HabitSlot"[];
