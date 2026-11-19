-- Brain dump: a seventh Mind practice, kept by the days you empty your head.
-- Additive only: a new enum, a new table and one new User switch.
-- CreateEnum
CREATE TYPE "BrainDumpKind" AS ENUM ('EMPTY', 'TOMORROW');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "mindBrainDumpEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "BrainDump" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "BrainDumpKind" NOT NULL DEFAULT 'EMPTY',
    "body" TEXT NOT NULL DEFAULT '',
    "paper" BOOLEAN NOT NULL DEFAULT false,
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BrainDump_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BrainDump_userId_date_idx" ON "BrainDump"("userId", "date");

-- AddForeignKey
ALTER TABLE "BrainDump" ADD CONSTRAINT "BrainDump_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
