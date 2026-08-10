-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "feedbackPrompt" TEXT,
ADD COLUMN     "requiresFeedback" BOOLEAN NOT NULL DEFAULT false;
