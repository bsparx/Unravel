-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('TODO', 'HABIT');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('P1', 'P2', 'P3', 'P4');

-- CreateEnum
CREATE TYPE "RecurrenceKind" AS ENUM ('DAILY', 'SPECIFIC_DAYS');

-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('PENDING', 'DONE', 'SKIPPED');

-- CreateEnum
CREATE TYPE "TimerMode" AS ENUM ('POMODORO', 'BASIC', 'FLOW', 'RECOVERY');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('RUNNING', 'PAUSED', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "SessionEndReason" AS ENUM ('TARGET_REACHED', 'USER_STOPPED', 'TASK_COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "IntervalKind" AS ENUM ('FOCUS', 'SHORT_BREAK', 'LONG_BREAK', 'RECOVERY');

-- CreateEnum
CREATE TYPE "CaptureStatus" AS ENUM ('RAW', 'PROMOTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "HabitUnit" AS ENUM ('MINUTES', 'COUNT');

-- CreateEnum
CREATE TYPE "QuotaTier" AS ENUM ('NONE', 'MINIMUM', 'OPTIMAL');

-- CreateEnum
CREATE TYPE "JournalKind" AS ENUM ('WORRY', 'GRATITUDE');

-- CreateEnum
CREATE TYPE "BlockKind" AS ENUM ('WORK', 'RECOVERY', 'BUFFER');

-- CreateEnum
CREATE TYPE "MoneyKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "imageUrl" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "weekStart" INTEGER NOT NULL DEFAULT 1,
    "pomodoroSeconds" INTEGER NOT NULL DEFAULT 1500,
    "shortBreakSeconds" INTEGER NOT NULL DEFAULT 300,
    "longBreakSeconds" INTEGER NOT NULL DEFAULT 900,
    "longBreakEvery" INTEGER NOT NULL DEFAULT 4,
    "autoStartBreaks" BOOLEAN NOT NULL DEFAULT false,
    "autoStartNextFocus" BOOLEAN NOT NULL DEFAULT false,
    "soundEnabled" BOOLEAN NOT NULL DEFAULT true,
    "hapticsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "returnAlertsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "waterGoal" INTEGER NOT NULL DEFAULT 8,
    "waterRemindersEnabled" BOOLEAN NOT NULL DEFAULT false,
    "waterReminderStartMin" INTEGER NOT NULL DEFAULT 480,
    "waterReminderEndMin" INTEGER NOT NULL DEFAULT 1320,
    "waterReminderIntervalMin" INTEGER NOT NULL DEFAULT 120,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'teal',
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT,
    "type" "TaskType" NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'P4',
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dueDate" DATE,
    "estimatedSeconds" INTEGER,
    "defaultMode" "TimerMode" NOT NULL DEFAULT 'POMODORO',
    "plannedIntervals" INTEGER,
    "completedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskStep" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "estimatedSeconds" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabitRecurrence" (
    "taskId" TEXT NOT NULL,
    "kind" "RecurrenceKind" NOT NULL DEFAULT 'DAILY',
    "daysOfWeek" INTEGER[],
    "unit" "HabitUnit" NOT NULL DEFAULT 'MINUTES',
    "minimumQuota" INTEGER NOT NULL DEFAULT 1,
    "optimalQuota" INTEGER,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HabitRecurrence_pkey" PRIMARY KEY ("taskId")
);

-- CreateTable
CREATE TABLE "HabitCue" (
    "taskId" TEXT NOT NULL,
    "anchorTaskId" TEXT,
    "anchorLabel" TEXT,
    "anchorMinutes" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HabitCue_pkey" PRIMARY KEY ("taskId")
);

-- CreateTable
CREATE TABLE "TaskOccurrence" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "note" TEXT,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "tier" "QuotaTier" NOT NULL DEFAULT 'NONE',
    "loggedSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskOccurrence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FocusSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "occurrenceId" TEXT,
    "clientKey" TEXT NOT NULL,
    "mode" "TimerMode" NOT NULL,
    "targetSeconds" INTEGER NOT NULL,
    "plannedIntervals" INTEGER NOT NULL DEFAULT 1,
    "focusSeconds" INTEGER NOT NULL,
    "shortBreakSeconds" INTEGER NOT NULL,
    "longBreakSeconds" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "accumulatedSeconds" INTEGER NOT NULL DEFAULT 0,
    "runningSince" TIMESTAMP(3),
    "lastBeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "overtimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "reachedTargetAt" TIMESTAMP(3),
    "pausedCount" INTEGER NOT NULL DEFAULT 0,
    "measuredSeconds" INTEGER,
    "adjustedAt" TIMESTAMP(3),
    "completedTask" BOOLEAN NOT NULL DEFAULT false,
    "endReason" "SessionEndReason",
    "localDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FocusSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionInterval" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "kind" "IntervalKind" NOT NULL DEFAULT 'FOCUS',
    "targetSeconds" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "accumulatedSeconds" INTEGER NOT NULL DEFAULT 0,
    "runningSince" TIMESTAMP(3),
    "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "overtimeSeconds" INTEGER NOT NULL DEFAULT 0,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "returnNote" TEXT,

    CONSTRAINT "SessionInterval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Capture" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "CaptureStatus" NOT NULL DEFAULT 'RAW',
    "promotedTaskId" TEXT,
    "localDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Capture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaterGlass" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "timeMinute" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaterGlass_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DayLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "selectedTaskId" TEXT,
    "selectedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DayLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "date" DATE NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "kind" "BlockKind" NOT NULL DEFAULT 'WORK',
    "completedAt" TIMESTAMP(3),
    "cueForId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "kind" "JournalKind" NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyCategory" (
    "id" TEXT NOT NULL,
    "ownerKey" TEXT NOT NULL,
    "userId" TEXT,
    "kind" "MoneyKind" NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'teal',
    "sortOrder" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MoneyTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "note" TEXT,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_clerkId_key" ON "User"("clerkId");

-- CreateIndex
CREATE INDEX "Project_userId_archivedAt_sortOrder_idx" ON "Project"("userId", "archivedAt", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Project_userId_name_key" ON "Project"("userId", "name");

-- CreateIndex
CREATE INDEX "Task_userId_type_completedAt_archivedAt_dueDate_idx" ON "Task"("userId", "type", "completedAt", "archivedAt", "dueDate");

-- CreateIndex
CREATE INDEX "Task_userId_projectId_sortOrder_idx" ON "Task"("userId", "projectId", "sortOrder");

-- CreateIndex
CREATE INDEX "TaskStep_taskId_position_idx" ON "TaskStep"("taskId", "position");

-- CreateIndex
CREATE INDEX "TaskStep_userId_completedAt_idx" ON "TaskStep"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "HabitCue_anchorTaskId_idx" ON "HabitCue"("anchorTaskId");

-- CreateIndex
CREATE INDEX "TaskOccurrence_userId_date_status_idx" ON "TaskOccurrence"("userId", "date", "status");

-- CreateIndex
CREATE INDEX "TaskOccurrence_userId_taskId_date_idx" ON "TaskOccurrence"("userId", "taskId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TaskOccurrence_taskId_date_key" ON "TaskOccurrence"("taskId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "FocusSession_clientKey_key" ON "FocusSession"("clientKey");

-- CreateIndex
CREATE INDEX "FocusSession_userId_localDate_idx" ON "FocusSession"("userId", "localDate");

-- CreateIndex
CREATE INDEX "FocusSession_userId_status_lastBeatAt_idx" ON "FocusSession"("userId", "status", "lastBeatAt");

-- CreateIndex
CREATE INDEX "FocusSession_taskId_startedAt_idx" ON "FocusSession"("taskId", "startedAt");

-- CreateIndex
CREATE INDEX "FocusSession_occurrenceId_idx" ON "FocusSession"("occurrenceId");

-- CreateIndex
CREATE INDEX "SessionInterval_sessionId_idx" ON "SessionInterval"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionInterval_sessionId_index_key" ON "SessionInterval"("sessionId", "index");

-- CreateIndex
CREATE INDEX "Capture_userId_status_createdAt_idx" ON "Capture"("userId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Capture_userId_localDate_idx" ON "Capture"("userId", "localDate");

-- CreateIndex
CREATE INDEX "WaterGlass_userId_date_idx" ON "WaterGlass"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DayLog_userId_date_key" ON "DayLog"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TimeBlock_cueForId_key" ON "TimeBlock"("cueForId");

-- CreateIndex
CREATE INDEX "TimeBlock_userId_date_startMinute_idx" ON "TimeBlock"("userId", "date", "startMinute");

-- CreateIndex
CREATE INDEX "TimeBlock_taskId_date_idx" ON "TimeBlock"("taskId", "date");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_date_idx" ON "JournalEntry"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_userId_date_kind_key" ON "JournalEntry"("userId", "date", "kind");

-- CreateIndex
CREATE INDEX "MoneyCategory_ownerKey_archivedAt_sortOrder_idx" ON "MoneyCategory"("ownerKey", "archivedAt", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyCategory_ownerKey_kind_name_key" ON "MoneyCategory"("ownerKey", "kind", "name");

-- CreateIndex
CREATE INDEX "MoneyTransaction_userId_date_idx" ON "MoneyTransaction"("userId", "date");

-- CreateIndex
CREATE INDEX "MoneyTransaction_userId_categoryId_idx" ON "MoneyTransaction"("userId", "categoryId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStep" ADD CONSTRAINT "TaskStep_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskStep" ADD CONSTRAINT "TaskStep_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitRecurrence" ADD CONSTRAINT "HabitRecurrence_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitCue" ADD CONSTRAINT "HabitCue_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabitCue" ADD CONSTRAINT "HabitCue_anchorTaskId_fkey" FOREIGN KEY ("anchorTaskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskOccurrence" ADD CONSTRAINT "TaskOccurrence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskOccurrence" ADD CONSTRAINT "TaskOccurrence_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusSession" ADD CONSTRAINT "FocusSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusSession" ADD CONSTRAINT "FocusSession_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FocusSession" ADD CONSTRAINT "FocusSession_occurrenceId_fkey" FOREIGN KEY ("occurrenceId") REFERENCES "TaskOccurrence"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionInterval" ADD CONSTRAINT "SessionInterval_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "FocusSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capture" ADD CONSTRAINT "Capture_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Capture" ADD CONSTRAINT "Capture_promotedTaskId_fkey" FOREIGN KEY ("promotedTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaterGlass" ADD CONSTRAINT "WaterGlass_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayLog" ADD CONSTRAINT "DayLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DayLog" ADD CONSTRAINT "DayLog_selectedTaskId_fkey" FOREIGN KEY ("selectedTaskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeBlock" ADD CONSTRAINT "TimeBlock_cueForId_fkey" FOREIGN KEY ("cueForId") REFERENCES "TimeBlock"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyCategory" ADD CONSTRAINT "MoneyCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MoneyCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

