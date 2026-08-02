-- AlterTable
ALTER TABLE "MoneyTransaction" ADD COLUMN     "budgetId" TEXT;

-- CreateTable
CREATE TABLE "MoneyBudget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyBudget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MoneyBudget_userId_archivedAt_startsOn_idx" ON "MoneyBudget"("userId", "archivedAt", "startsOn");

-- CreateIndex
CREATE INDEX "MoneyTransaction_userId_budgetId_idx" ON "MoneyTransaction"("userId", "budgetId");

-- AddForeignKey
ALTER TABLE "MoneyTransaction" ADD CONSTRAINT "MoneyTransaction_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "MoneyBudget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MoneyBudget" ADD CONSTRAINT "MoneyBudget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
