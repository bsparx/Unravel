-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "endingSummaryEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE IF NOT EXISTS "EndingSummary" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "keepDoing" TEXT,
    "tryTomorrow" TEXT,
    "avoid" TEXT,
    "habitsDone" INTEGER,
    "habitsTotal" INTEGER,
    "productiveSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EndingSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "EndingSummary_userId_date_key" ON "EndingSummary"("userId", "date");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "EndingSummary_userId_date_idx" ON "EndingSummary"("userId", "date");

-- AddForeignKey
ALTER TABLE "EndingSummary" ADD CONSTRAINT "EndingSummary_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
