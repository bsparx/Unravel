-- Heart: gratitude and du'a move to their own page (no data change; they keep
-- their columns and rows), and a new daily recitation practice.
-- Additive only: two User columns and two new tables.
-- AlterTable
ALTER TABLE "User" ADD COLUMN "heartRecitationEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "recitationSet" JSONB;

-- CreateTable
CREATE TABLE "RecitationLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "items" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecitationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomRecitation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "arabic" TEXT NOT NULL DEFAULT '',
    "transliteration" TEXT NOT NULL DEFAULT '',
    "translation" TEXT NOT NULL DEFAULT '',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomRecitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RecitationLog_userId_date_key" ON "RecitationLog"("userId", "date");

-- CreateIndex
CREATE INDEX "RecitationLog_userId_date_idx" ON "RecitationLog"("userId", "date");

-- CreateIndex
CREATE INDEX "CustomRecitation_userId_archivedAt_idx" ON "CustomRecitation"("userId", "archivedAt");

-- AddForeignKey
ALTER TABLE "RecitationLog" ADD CONSTRAINT "RecitationLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomRecitation" ADD CONSTRAINT "CustomRecitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
