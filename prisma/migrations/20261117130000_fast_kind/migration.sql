-- Fasting gains a kind: intermittent (an eating window) or Islamic (Fajr
-- to Maghrib). Additive; every existing fast is intermittent.
-- CreateEnum
CREATE TYPE "FastKind" AS ENUM ('INTERMITTENT', 'ISLAMIC');

-- AlterTable
ALTER TABLE "Fast" ADD COLUMN     "kind" "FastKind" NOT NULL DEFAULT 'INTERMITTENT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "fastKind" "FastKind" NOT NULL DEFAULT 'INTERMITTENT';

