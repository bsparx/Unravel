-- WOOP moves off tasks and habits onto its own page (/mind).
-- Both the column and the old per-task table were empty when this was written.

-- AlterTable
ALTER TABLE "Task" DROP COLUMN "requiresWoop";

-- DropTable
DROP TABLE "Woop";

-- CreateEnum
CREATE TYPE "WishStatus" AS ENUM ('ACTIVE', 'ACHIEVED', 'RELEASED');

-- CreateTable
CREATE TABLE "Wish" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wish" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "obstacle" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "status" "WishStatus" NOT NULL DEFAULT 'ACTIVE',
    "settledAt" TIMESTAMP(3),
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wish_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Disputation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "adversity" TEXT NOT NULL,
    "belief" TEXT NOT NULL,
    "beliefBefore" INTEGER,
    "consequences" TEXT NOT NULL,
    "evidence" TEXT,
    "alternatives" TEXT,
    "implications" TEXT,
    "usefulness" TEXT,
    "energization" TEXT NOT NULL,
    "beliefAfter" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Disputation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Wish_userId_status_sortOrder_idx" ON "Wish"("userId", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "Disputation_userId_createdAt_idx" ON "Disputation"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Wish" ADD CONSTRAINT "Wish_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Disputation" ADD CONSTRAINT "Disputation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
