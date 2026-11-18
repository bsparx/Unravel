-- Mind scenes are kept by the last two weeks: wishes count the days one was
-- rehearsed, disputations the days one was written or revisited. Additive only.
-- CreateTable
CREATE TABLE "WishRehearsal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "wishId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishRehearsal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisputationRevisit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "disputationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "belief" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisputationRevisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WishRehearsal_userId_date_idx" ON "WishRehearsal"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "WishRehearsal_wishId_date_key" ON "WishRehearsal"("wishId", "date");

-- CreateIndex
CREATE INDEX "DisputationRevisit_userId_date_idx" ON "DisputationRevisit"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DisputationRevisit_disputationId_date_key" ON "DisputationRevisit"("disputationId", "date");

-- AddForeignKey
ALTER TABLE "WishRehearsal" ADD CONSTRAINT "WishRehearsal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishRehearsal" ADD CONSTRAINT "WishRehearsal_wishId_fkey" FOREIGN KEY ("wishId") REFERENCES "Wish"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputationRevisit" ADD CONSTRAINT "DisputationRevisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisputationRevisit" ADD CONSTRAINT "DisputationRevisit_disputationId_fkey" FOREIGN KEY ("disputationId") REFERENCES "Disputation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
