-- Interval blocks: one thing every 15 or 30 minutes.
--
-- Additive only. Every existing block keeps `beatMinutes` null and reads
-- exactly as it did.

-- AlterTable
ALTER TABLE "TimeBlock" ADD COLUMN "beatMinutes" INTEGER;

-- CreateTable
CREATE TABLE "TimeBlockBeat" (
    "blockId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "label" TEXT,

    CONSTRAINT "TimeBlockBeat_pkey" PRIMARY KEY ("blockId","index")
);

-- AddForeignKey
ALTER TABLE "TimeBlockBeat" ADD CONSTRAINT "TimeBlockBeat_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "TimeBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;
