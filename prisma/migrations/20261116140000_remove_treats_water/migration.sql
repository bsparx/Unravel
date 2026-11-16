-- Treats, chapters and water are removed from the app, data included.

-- DropForeignKey
ALTER TABLE "ChapterObjective" DROP CONSTRAINT "ChapterObjective_chapterId_fkey";
ALTER TABLE "ChapterObjective" DROP CONSTRAINT "ChapterObjective_habitId_fkey";
ALTER TABLE "Chapter" DROP CONSTRAINT "Chapter_userId_fkey";
ALTER TABLE "Chapter" DROP CONSTRAINT "Chapter_identityId_fkey";
ALTER TABLE "Treat" DROP CONSTRAINT "Treat_userId_fkey";
ALTER TABLE "Treat" DROP CONSTRAINT "Treat_identityId_fkey";
ALTER TABLE "WaterGlass" DROP CONSTRAINT "WaterGlass_userId_fkey";

-- DropTable
DROP TABLE "ChapterObjective";
DROP TABLE "Chapter";
DROP TABLE "Treat";
DROP TABLE "WaterGlass";

-- AlterTable
ALTER TABLE "User"
  DROP COLUMN "waterGoal",
  DROP COLUMN "waterRemindersEnabled",
  DROP COLUMN "waterReminderStartMin",
  DROP COLUMN "waterReminderEndMin",
  DROP COLUMN "waterReminderIntervalMin";
