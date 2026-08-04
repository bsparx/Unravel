-- CreateEnum
CREATE TYPE "DebtDirection" AS ENUM ('I_OWE', 'OWED_TO_ME');

-- CreateTable
CREATE TABLE "MoneyDebt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL,
    "direction" "DebtDirection" NOT NULL,
    "note" TEXT,
    "amountCents" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MoneyDebt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MoneyDebt_userId_direction_settledAt_date_idx" ON "MoneyDebt"("userId", "direction", "settledAt", "date");

-- AddForeignKey
ALTER TABLE "MoneyDebt" ADD CONSTRAINT "MoneyDebt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
