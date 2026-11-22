-- AlterTable
ALTER TABLE "User"
ADD COLUMN "bodyExercisesSceneEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "bodyFastingSceneEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "fastDaysOfWeek" INTEGER[] DEFAULT ARRAY[0, 1, 2, 3, 4, 5, 6]::INTEGER[];

-- CreateTable
CREATE TABLE "ExerciseCheckoff" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseCheckoff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExerciseCheckoff_userId_date_idx" ON "ExerciseCheckoff"("userId", "date");

-- CreateIndex
CREATE INDEX "ExerciseCheckoff_exerciseId_idx" ON "ExerciseCheckoff"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseCheckoff_userId_exerciseId_date_key" ON "ExerciseCheckoff"("userId", "exerciseId", "date");

-- AddForeignKey
ALTER TABLE "ExerciseCheckoff" ADD CONSTRAINT "ExerciseCheckoff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseCheckoff" ADD CONSTRAINT "ExerciseCheckoff_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
