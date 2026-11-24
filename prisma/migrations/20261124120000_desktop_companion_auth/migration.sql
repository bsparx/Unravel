-- CreateTable
CREATE TABLE "DesktopApiToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesktopApiToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DesktopAuthCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DesktopAuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesktopApiToken_tokenHash_key" ON "DesktopApiToken"("tokenHash");

-- CreateIndex
CREATE INDEX "DesktopApiToken_userId_revokedAt_idx" ON "DesktopApiToken"("userId", "revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DesktopAuthCode_codeHash_key" ON "DesktopAuthCode"("codeHash");

-- CreateIndex
CREATE INDEX "DesktopAuthCode_expiresAt_idx" ON "DesktopAuthCode"("expiresAt");

-- AddForeignKey
ALTER TABLE "DesktopApiToken" ADD CONSTRAINT "DesktopApiToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DesktopAuthCode" ADD CONSTRAINT "DesktopAuthCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
