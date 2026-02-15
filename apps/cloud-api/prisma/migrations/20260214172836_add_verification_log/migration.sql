-- CreateTable
CREATE TABLE "VerificationLog" (
    "id" TEXT NOT NULL,
    "credentialId" TEXT NOT NULL,
    "orgName" TEXT NOT NULL,
    "result" BOOLEAN NOT NULL,
    "hashValid" BOOLEAN NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VerificationLog_createdAt_idx" ON "VerificationLog"("createdAt");
