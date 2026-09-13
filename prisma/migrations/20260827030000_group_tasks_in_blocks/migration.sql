-- A block can now be for several tasks, not one.
--
-- The order below is the whole point of writing this by hand instead of taking
-- the generated script: Prisma's diff drops "TimeBlock"."taskId" before it
-- creates the new table, which would throw away every existing link. The
-- backfill has to land before the drop.

-- CreateTable
CREATE TABLE "TimeBlockTask" (
    "blockId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3),
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeBlockTask_pkey" PRIMARY KEY ("blockId","taskId")
);

-- Backfill: every block that named a task becomes a block whose task list is
-- that one task. Lossless — the block, its title, its times and its logged
-- sessions are all untouched.
INSERT INTO "TimeBlockTask" ("blockId", "taskId")
SELECT "id", "taskId" FROM "TimeBlock" WHERE "taskId" IS NOT NULL;

-- CreateIndex
CREATE INDEX "TimeBlockTask_taskId_blockId_idx" ON "TimeBlockTask"("taskId", "blockId");

-- AddForeignKey
ALTER TABLE "TimeBlockTask" ADD CONSTRAINT "TimeBlockTask_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "TimeBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeBlockTask" ADD CONSTRAINT "TimeBlockTask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "TimeBlock" DROP CONSTRAINT "TimeBlock_taskId_fkey";

-- DropIndex
DROP INDEX "TimeBlock_taskId_date_idx";

-- AlterTable
ALTER TABLE "TimeBlock" DROP COLUMN "taskId";
