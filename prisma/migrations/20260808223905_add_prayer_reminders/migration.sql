-- CreateEnum
CREATE TYPE "PrayerKind" AS ENUM ('FAJR', 'ZUHR', 'ASR', 'MAGHRIB', 'ISHA');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "prayerCity" TEXT,
ADD COLUMN     "prayerRemindersEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PrayerCheck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "prayer" "PrayerKind" NOT NULL,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrayerCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrayerDayTimes" (
    "id" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "timings" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrayerDayTimes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrayerCheck_userId_date_idx" ON "PrayerCheck"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PrayerCheck_userId_date_prayer_key" ON "PrayerCheck"("userId", "date", "prayer");

-- CreateIndex
CREATE UNIQUE INDEX "PrayerDayTimes_city_date_key" ON "PrayerDayTimes"("city", "date");

-- AddForeignKey
ALTER TABLE "PrayerCheck" ADD CONSTRAINT "PrayerCheck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
