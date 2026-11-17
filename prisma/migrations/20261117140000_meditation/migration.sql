-- Meditation joins /mind: a switch, and one row per sitting. Additive only.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mindMeditationEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "MeditationSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "options" JSONB,
    "plannedSeconds" INTEGER NOT NULL,
    "seconds" INTEGER NOT NULL,
    "count" INTEGER,
    "completed" BOOLEAN NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MeditationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MeditationSession_userId_startedAt_idx" ON "MeditationSession"("userId", "startedAt");

-- AddForeignKey
ALTER TABLE "MeditationSession" ADD CONSTRAINT "MeditationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

