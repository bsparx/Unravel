-- AlterTable
ALTER TABLE "Task" ADD COLUMN "requiresWoop" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Woop" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "wish" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "obstacle" TEXT NOT NULL,
    "plan" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Woop_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Woop_userId_taskId_date_idx" ON "Woop"("userId", "taskId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Woop_taskId_date_key" ON "Woop"("taskId", "date");

-- AddForeignKey
ALTER TABLE "Woop" ADD CONSTRAINT "Woop_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Woop" ADD CONSTRAINT "Woop_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
