-- Gratitude and du'a join /mind as daily pages, each practice switchable,
-- with a chosen template. Additive only: JournalEntry was empty when this
-- was written, and nothing is dropped.

-- AlterEnum
ALTER TYPE "JournalKind" ADD VALUE 'DUA';

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN "template" TEXT,
ADD COLUMN "items" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "mindWoopEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "mindDisputationEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "mindGratitudeEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "mindDuaEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "gratitudeTemplate" TEXT NOT NULL DEFAULT 'good-things',
ADD COLUMN "gratitudeCount" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "duaTemplate" TEXT NOT NULL DEFAULT 'adab',
ADD COLUMN "duaCount" INTEGER NOT NULL DEFAULT 3;
