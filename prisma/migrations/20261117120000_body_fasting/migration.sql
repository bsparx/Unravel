-- /body: exercises and intermittent fasting, each switchable, plus the
-- eating window and a log of fasts. Additive only.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bodyExercisesEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "bodyFastingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "fastEatEnd" INTEGER NOT NULL DEFAULT 1200,
ADD COLUMN     "fastEatStart" INTEGER NOT NULL DEFAULT 720;

-- CreateTable
CREATE TABLE "Fast" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "targetMinutes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Fast_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Fast_userId_startedAt_idx" ON "Fast"("userId", "startedAt");

-- AddForeignKey
ALTER TABLE "Fast" ADD CONSTRAINT "Fast_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

