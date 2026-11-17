-- Reading joins /mind: a switch, books, and one row per sitting with a book. Additive only.
-- CreateEnum
CREATE TYPE "BookStatus" AS ENUM ('READING', 'UP_NEXT', 'FINISHED', 'SET_ASIDE');

-- CreateEnum
CREATE TYPE "ReadingUnit" AS ENUM ('PAGE', 'PERCENT');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "mindReadingEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "unit" "ReadingUnit" NOT NULL DEFAULT 'PAGE',
    "totalPages" INTEGER,
    "startPage" INTEGER NOT NULL DEFAULT 0,
    "cover" TEXT NOT NULL,
    "status" "BookStatus" NOT NULL DEFAULT 'READING',
    "summary" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "fromPage" INTEGER NOT NULL,
    "toPage" INTEGER NOT NULL,
    "note" TEXT,
    "quote" TEXT,
    "quotePage" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReadingLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Book_userId_status_sortOrder_idx" ON "Book"("userId", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "ReadingLog_userId_date_idx" ON "ReadingLog"("userId", "date");

-- CreateIndex
CREATE INDEX "ReadingLog_bookId_fromPage_idx" ON "ReadingLog"("bookId", "fromPage");

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingLog" ADD CONSTRAINT "ReadingLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingLog" ADD CONSTRAINT "ReadingLog_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

