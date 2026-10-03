-- CreateEnum
CREATE TYPE "IdentityKind" AS ENUM ('REAL', 'FICTIONAL');

-- CreateEnum
CREATE TYPE "ShadowMark" AS ENUM ('NOTICED', 'CHOSE');

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "pairing" TEXT;

-- AlterTable
ALTER TABLE "Identity" ADD COLUMN     "archetype" TEXT,
ADD COLUMN     "colorSlot" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "kind" "IdentityKind",
ADD COLUMN     "question" TEXT,
ADD COLUMN     "sigil" TEXT;

-- AlterTable
ALTER TABLE "DayLog" ADD COLUMN     "leadIdentityId" TEXT;

-- AlterTable
ALTER TABLE "TimeBlock" ADD COLUMN     "identityId" TEXT;

-- CreateTable
CREATE TABLE "ShadowPattern" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "law" TEXT,
    "plan" TEXT,
    "identityId" TEXT,
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShadowPattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShadowLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "patternId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mark" "ShadowMark" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShadowLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Treat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "identityId" TEXT,
    "votesNeeded" INTEGER NOT NULL,
    "enjoyedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Treat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "intro" TEXT,
    "startDate" DATE NOT NULL,
    "lengthDays" INTEGER NOT NULL DEFAULT 10,
    "reward" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChapterObjective" (
    "id" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "target" INTEGER NOT NULL DEFAULT 1,
    "habitId" TEXT,
    "logged" INTEGER NOT NULL DEFAULT 0,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ChapterObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeeklyReview" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" DATE NOT NULL,
    "leadIdentityId" TEXT,
    "statement" TEXT,
    "adjustment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShadowPattern_userId_archivedAt_idx" ON "ShadowPattern"("userId", "archivedAt");

-- CreateIndex
CREATE INDEX "ShadowLog_userId_date_idx" ON "ShadowLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ShadowLog_patternId_date_key" ON "ShadowLog"("patternId", "date");

-- CreateIndex
CREATE INDEX "Treat_userId_idx" ON "Treat"("userId");

-- CreateIndex
CREATE INDEX "Chapter_userId_completedAt_idx" ON "Chapter"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "ChapterObjective_chapterId_idx" ON "ChapterObjective"("chapterId");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyReview_userId_weekStart_key" ON "WeeklyReview"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "TimeBlock_identityId_idx" ON "TimeBlock"("identityId");

-- AddForeignKey
ALTER TABLE "DayLog" ADD CONSTRAINT "DayLog_leadIdentityId_fkey" FOREIGN KEY ("leadIdentityId") REFERENCES "Identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShadowPattern" ADD CONSTRAINT "ShadowPattern_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShadowPattern" ADD CONSTRAINT "ShadowPattern_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShadowLog" ADD CONSTRAINT "ShadowLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShadowLog" ADD CONSTRAINT "ShadowLog_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "ShadowPattern"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treat" ADD CONSTRAINT "Treat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Treat" ADD CONSTRAINT "Treat_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chapter" ADD CONSTRAINT "Chapter_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "Identity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterObjective" ADD CONSTRAINT "ChapterObjective_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterObjective" ADD CONSTRAINT "ChapterObjective_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyReview" ADD CONSTRAINT "WeeklyReview_leadIdentityId_fkey" FOREIGN KEY ("leadIdentityId") REFERENCES "Identity"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Backfill: give existing identities distinct hues in the order the user
-- already sees them, so neighbours never share a colour.
UPDATE "Identity" AS i
SET "colorSlot" = ((ranked.rn - 1) % 6) + 1
FROM (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "userId" ORDER BY "sortOrder", "name") AS rn
  FROM "Identity"
) AS ranked
WHERE ranked."id" = i."id";
